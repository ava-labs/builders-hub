#!/bin/bash
# Pulls latest pre-built node binary from GitHub and installs it as a systemd service.
# Intended for non-technical validators, assumes running on compatible Ubuntu.

#stop on errors
set -e

#running as root gives the wrong homedir, check and exit if run with sudo.
if ((EUID == 0)); then
    echo "The script is not designed to run as root user. Please run it without sudo prefix."
    exit 1
fi

#helper function to create avalanchego.service file
create_service_file () {
  rm -f avalanchego.service
  echo "[Unit]">>avalanchego.service
  echo "Description=AvalancheGo systemd service">>avalanchego.service
  echo "StartLimitIntervalSec=0">>avalanchego.service
  echo "[Service]">>avalanchego.service
  echo "Type=simple">>avalanchego.service
  echo "User=$(whoami)">>avalanchego.service
  echo "WorkingDirectory=$HOME">>avalanchego.service
  echo "ExecStart=$HOME/avalanche-node/avalanchego --config-file=$HOME/.avalanchego/configs/node.json">>avalanchego.service
  echo "LimitNOFILE=32768">>avalanchego.service
  echo "Restart=always">>avalanchego.service
  echo "RestartSec=1">>avalanchego.service
  echo "[Install]">>avalanchego.service
  echo "WantedBy=multi-user.target">>avalanchego.service
  echo "">>avalanchego.service
}

create_config_file () {
  rm -f node.json
  echo "{" >>node.json
  if [ "$rpcOpt" = "public" ]; then
    echo "  \"http-host\": \"\",">>node.json
  fi
  if [ "$adminOpt" = "true" ]; then
    echo "  \"api-admin-enabled\": true,">>node.json
  fi
  if [ "$indexOpt" = "true" ]; then
    echo "  \"index-enabled\": true,">>node.json
  fi
  if [ "$fujiOpt" = "true" ]; then
    echo "  \"network-id\": \"fuji\",">>node.json
  fi
  if [ "$dbdirOpt" != "no" ]; then
    echo "  \"db-dir\": \"$dbdirOpt\",">>node.json
  fi
  if [ "$ipChoice" = "1" ]; then
    echo "  \"public-ip-resolution-service\": \"opendns\"">>node.json
  else
    echo "  \"public-ip\": \"$foundIP\"">>node.json
  fi
  echo "}" >>node.json
  mkdir -p $HOME/.avalanchego/configs
  cp -f node.json $HOME/.avalanchego/configs/node.json

  rm -f config.json
  echo "{" >>config.json
  if [ "$archivalOpt" = "true" ]; then
    commaAdd=","
  else
    commaAdd=""
  fi
  if [ "$stateOpt" = "on" ]; then
    echo "  \"state-sync-enabled\": true$commaAdd">>config.json
  fi
  if [ "$stateOpt" = "off" ]; then
    echo "  \"state-sync-enabled\": false">>config.json
  fi
  if [ "$archivalOpt" = "true" ]; then
    echo "  \"pruning-enabled\": false">>config.json
  fi
  echo "}" >>config.json
  mkdir -p $HOME/.avalanchego/configs/chains/C
  cp -f config.json $HOME/.avalanchego/configs/chains/C/config.json
}

remove_service_file () {
  if test -f "/etc/systemd/system/avalanchego.service"; then
    sudo systemctl stop avalanchego
    sudo systemctl disable avalanchego
    sudo rm /etc/systemd/system/avalanchego.service
  fi
}

#helper function to check for presence of required commands, and install if missing
check_reqs_deb () {
  if ! command -v curl &> /dev/null
  then
      echo "curl could not be found, will install..."
      sudo apt-get install curl -y
  fi
  if ! command -v wget &> /dev/null
  then
      echo "wget could not be found, will install..."
      sudo apt-get install wget -y
  fi
  if ! command -v dig &> /dev/null
  then
      echo "dig could not be found, will install..."
      sudo apt-get install dnsutils -y
  fi
}
check_reqs_rhel () {
  if ! command -v curl &> /dev/null
  then
      echo "curl could not be found, will install..."
      sudo dnf install curl -y
  fi
  if ! command -v wget &> /dev/null
  then
      echo "wget could not be found, will install..."
      sudo dnf install wget -y
  fi
  if ! command -v dig &> /dev/null
  then
      echo "dig could not be found, will install..."
      sudo dnf install bind-utils -y
  fi
  if ! command -v semanage &> /dev/null
  then
      echo "semanage could not be found, will install..."
      sudo dnf install policycoreutils-python-utils -y
  fi
  if ! command -v restorecon &> /dev/null
  then
      echo "restorecon could not be found, will install..."
      sudo dnf install policycoreutils -y
  fi
}
getOsType () {
foundOS="$(uname)"                              #get OS
if [ "$foundOS" = "Linux" ]; then
  which yum 1>/dev/null 2>&1 && { echo "RHEL"; return; }
  which zypper 1>/dev/null 2>&1 && { echo "openSUSE"; return; }
  which apt-get 1>/dev/null 2>&1 && { echo "Debian"; return; }
else
  echo "$foundOS";
  return;
fi
}


#helper function that prints usage
usage () {
  echo "Usage: $0 [--list | --help | --reinstall | --remove] [--version <tag>] [--ip dynamic|static|<IP>]"
  echo "                     [--rpc private|public] [--archival] [--state-sync on|off] [--index] [--db-dir <path>]"
  echo "Options:"
  echo "   --help            Shows this message"
  echo "   --list            Lists 10 newest versions available to install"
  echo "   --reinstall       Run the installer from scratch, overwriting the old service file and node configuration"
  echo "   --remove          Remove the system service and AvalancheGo binaries and exit"
  echo ""
  echo "   --version <tag>          Installs <tag> version, default is the latest"
  echo "   --ip dynamic|static|<IP> Uses dynamic, static (autodetect) or provided public IP, will ask if not provided"
  echo "   --rpc private|public     Open RPC port (9650) to private or public network interfaces, will ask if not provided"
  echo "   --archival               If provided, will disable state pruning, defaults to pruning enabled"
  echo "   --state-sync on|off      If provided explicitly turns C-Chain state sync on or off"
  echo "   --index                  If provided, will enable indexer and Index API, defaults to disabled"
  echo "   --db-dir <path>          Full path to the database directory, defaults to $HOME/.avalanchego/db"
  echo "   --fuji                   Connect to Fuji testnet, defaults to mainnet if omitted"
  echo "   --admin                  Enable Admin API, defaults to disabled if omitted"
  echo ""
  echo "Run without any options, script will install or upgrade AvalancheGo to latest available version. Node config"
  echo "options for version, ip and others will be ignored when upgrading the node, run with --reinstall to change config."
  echo "Reinstall will not modify the database or NodeID definition, it will overwrite node and chain configs."
  exit 0
}

list_versions () {
  echo "Available versions:"
  wget -q -O - https://api.github.com/repos/ava-labs/avalanchego/releases \
  | grep tag_name \
  | sed 's/.*: "\(.*\)".*/\1/' \
  | head
  exit 0
}

# Argument parsing convenience functions.
usage_error () { echo >&2 "$(basename $0):  $1"; exit 2; }
assert_argument () { test "$1" != "$EOL" || usage_error "$2 requires an argument"; }

#initialise options
fujiOpt="no"
adminOpt="no"
rpcOpt="ask"
indexOpt="no"
archivalOpt="no"
dbdirOpt="no"
ipOpt="ask"
stateOpt="?"

echo "AvalancheGo installer"
echo "---------------------"

# process command line arguments
if [ "$#" != 0 ]; then
  EOL=$(echo '\01\03\03\07')
  set -- "$@" "$EOL"
  while [ "$1" != "$EOL" ]; do
    opt="$1"; shift
    case "$opt" in
      --list) list_versions ;;
      --version) assert_argument "$1" "$opt"; version="$1"; shift;;
      --reinstall) #recreate service file and install
        echo "Will reinstall the node."
        remove_service_file
        ;;
      --remove) #remove the service and node files
        echo "Removing the service..."
        remove_service_file
        echo "Remove node binaries..."
        rm -rf $HOME/avalanche-node
        echo "Done."
        echo "AvalancheGo removed. Working directory ($HOME/.avalanchego/) has been preserved."
        exit 0
        ;;
      --help) usage ;;
      --ip) assert_argument "$1" "$opt"; ipOpt="$1"; shift;;
      --rpc) assert_argument "$1" "$opt"; rpcOpt="$1"; shift;;
      --archival) archivalOpt='true';;
      --state-sync) assert_argument "$1" "$opt"; stateOpt="$1"; shift;;
      --index) indexOpt='true';;
      --db-dir) assert_argument "$1" "$opt"; dbdirOpt="$1"; shift;;
      --fuji) fujiOpt='true';;
      --admin) adminOpt='true';;

      -|''|[!-]*) set -- "$@" "$opt";;                                          # positional argument, rotate to the end
      --*=*)      set -- "${opt%%=*}" "${opt#*=}" "$@";;                        # convert '--name=arg' to '--name' 'arg'
      --)         while [ "$1" != "$EOL" ]; do set -- "$@" "$1"; shift; done;;  # process remaining arguments as positional
      -*)         usage_error "unknown option: '$opt'";;                        # catch misspelled options
      *)          usage_error "this should NEVER happen ($opt)";;               # sanity test for previous patterns

    esac
  done
  shift  # $EOL
fi

echo "Preparing environment..."
osType=$(getOsType)
if [ "$osType" = "Debian" ]; then
  check_reqs_deb
elif [ "$osType" = "RHEL" ]; then
  check_reqs_rhel
else
  #sorry, don't know you.
  echo "Unsupported OS or linux distribution found: $osType"
  echo "Exiting."
  exit 1
fi
foundIP="$(dig +short myip.opendns.com @resolver1.opendns.com)"
foundArch="$(uname -m)"                         #get system architecture
if [ "$foundArch" = "aarch64" ]; then
  getArch="arm64"                               #we're running on arm arch (probably RasPi)
  echo "Found arm64 architecture..."
elif [ "$foundArch" = "x86_64" ]; then
  getArch="amd64"                               #we're running on intel/amd
  echo "Found amd64 architecture..."
else
  #sorry, don't know you.
  echo "Unsupported architecture: $foundArch!"
  echo "Exiting."
  exit 1
fi
if test -f "/etc/systemd/system/avalanchego.service"; then
  foundAvalancheGo=true
  echo "Found AvalancheGo systemd service already installed, switching to upgrade mode."
  echo "Stopping service..."
  sudo systemctl stop avalanchego
else
  foundAvalancheGo=false
fi
# download and copy node files
mkdir -p /tmp/avalanchego-install               #make a directory to work in
rm -rf /tmp/avalanchego-install/*               #clean up in case previous install didn't
cd /tmp/avalanchego-install

version=${version:-latest}
echo "Looking for $getArch version $version..."
if [ "$version" = "latest" ]; then
  fileName="$(curl -s https://api.github.com/repos/ava-labs/avalanchego/releases/latest | grep "avalanchego-linux-$getArch.*tar\(.gz\)*\"" | cut -d : -f 2,3 | tr -d \" | cut -d , -f 2)"
else
  fileName="https://github.com/ava-labs/avalanchego/releases/download/$version/avalanchego-linux-$getArch-$version.tar.gz"
fi
if [[ `wget -S --spider $fileName  2>&1 | grep 'HTTP/1.1 200 OK'` ]]; then
  echo "Node version found."
  echo "Attempting to download: $fileName"
  wget -nv --show-progress $fileName

  echo "Unpacking node files..."
  mkdir -p $HOME/avalanche-node
  tar xvf avalanchego-linux*.tar.gz -C $HOME/avalanche-node --strip-components=1;
  mkdir -p $HOME/.avalanchego/plugins
  rm avalanchego-linux-*.tar.gz
  echo "Node files unpacked into $HOME/avalanche-node"
else
  shouldBuild=true
  if ! command -v git >/dev/null 2>&1 ; then
    echo "Missing git, will not attempt to build $version from source."
    shouldBuild=false
  fi
  if ! command -v go >/dev/null 2>&1 ; then
    echo "Missing go, will not attempt to build $version from source."
    shouldBuild=false
  fi
  if ! command -v gcc >/dev/null 2>&1 ; then
    echo "Missing gcc, will not attempt to build $version from source."
    shouldBuild=false
  fi
  if [ "$shouldBuild" = "false" ]; then
    echo "One or more building tools are missing. Exiting."
    if [ "$foundAvalancheGo" = "true" ]; then
      echo "Restarting service..."
      sudo systemctl start avalanchego
    fi
    exit 1
  fi

  echo "Unable to find AvalancheGo release $version. Attempting to build $version from source."
  mkdir -p avalanchego
  cd avalanchego
  git init
  git remote add origin https://github.com/ava-labs/avalanchego
  git fetch --depth 1 origin $version || {
    echo "Unable to find AvalancheGo commit $version. Exiting."
    if [ "$foundAvalancheGo" = "true" ]; then
      echo "Restarting service..."
      sudo systemctl start avalanchego
    fi
    exit 1
  }
  git checkout $version
  ./scripts/build.sh || {
    echo "Unable to build AvalancheGo commit $version. Exiting."
    if [ "$foundAvalancheGo" = "true" ]; then
      echo "Restarting service..."
      sudo systemctl start avalanchego
    fi
    exit 1
  }

  echo "Moving node binary..."
  mkdir -p $HOME/avalanche-node
  cp -r ./build/* $HOME/avalanche-node
  mkdir -p $HOME/.avalanchego/plugins
  cd ..
  rm -rf avalanchego
  echo "Node binary move to $HOME/avalanche-node"
fi
echo
# on RHEL based systems, selinux prevents systemd running execs from home-dir, lets change this
if [ "$osType" = "RHEL" ]; then
  # only way to make idempotent
  sudo semanage fcontext -a -t bin_t "$HOME/avalanche-node/avalanchego" || sudo semanage fcontext -m -t bin_t "$HOME/avalanche-node/avalanchego"
  sudo restorecon -Fv "$HOME/avalanche-node/avalanchego"
fi
if [ "$foundAvalancheGo" = "true" ]; then
  echo "Node upgraded, starting service..."
  sudo systemctl start avalanchego
  echo "New node version:"
  $HOME/avalanche-node/avalanchego --version
  echo "Done!"
  exit 0
fi
if [ "$ipOpt" = "ask" ]; then
  echo "To complete the setup, some networking information is needed."
  echo "Where is your node running?"
  echo "1) Residential network (dynamic IP)"
  echo "2) Cloud provider (static IP)"
  ipChoice="x"
  while [ "$ipChoice" != "1" ] && [ "$ipChoice" != "2" ]
  do
    read -p "Enter your connection type [1,2]: " ipChoice
  done
  if [ "$ipChoice" = "1" ]; then
    echo "Installing service with dynamic IP..."
  else
    read -p "Detected '$foundIP' as your public IP. Is this correct? [y,n]: " correct
    if [ "$correct" != "y" ]; then
      read -p "Enter your public IP: " foundIP
      if [[ ! $foundIP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        check=false               # ensure its a valid IP
      else
        check=true
      fi
      while [[ $check == false ]]
      do
         read -p "Invalid IP. Please Enter your public IP: " foundIP
         if [[ $foundIP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
              check=true
         fi
      done
    fi
    echo "Installing service with public IP: $foundIP"
  fi
elif [ "$ipOpt" = "dynamic" ]; then
  echo "Installing service with dynamic IP..."
  ipChoice="1"
elif [ "$ipOpt" = "static" ]; then
  echo "Detected '$foundIP' as your public IP."
  ipChoice="2"
else
  if [[ ! $ipOpt =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    echo "Provided IP ($ipOpt) does not look correct! Exiting."
    exit 1
  fi
  echo "Will use provided IP ($ipOpt) as public IP."
  foundIP="$ipOpt"
  ipChoice="2"
fi
if [ "$rpcOpt" = "ask" ]; then
  echo ""
  echo "Your node accepts RPC calls on port 9650. If restricted to private, it will be accessible only from this machine."
  echo "Only p2p port (9651 by default) NEEDS to be publicly accessible for correct node operation, RPC port is used for"
  echo "interaction with the node by the operator or applications and SHOULD NOT be freely accessible to the public."
  echo ""
  echo "Note: Validator nodes SHOULD NOT have their RPC port open!"
  echo ""
  while [ "$rpcOpt" != "public" ] && [ "$rpcOpt" != "private" ]
  do
    read -p "RPC port should be public (this is a public API node) or private (this is a validator)? [public, private]: " rpcOpt
  done
  if [ "$rpcOpt" = "public" ]; then
    echo ""
    echo "If firewall or other form of access control is not provided, your node will be open to denial of service attacks."
    echo "Node API server is not designed to defend against it! Make sure you configure the firewall to only let through"
    echo "RPC requests from known IP addresses!"
    echo ""
    confirm="ask"
    while [ "$confirm" != "yes" ] && [ "$confirm" != "no" ]
    do
      read -p "Are you sure you want to allow public access to the RPC port? [yes, no]: " confirm
    done
    if [ "$confirm" != "yes" ]; then
      rpcOpt="private"
    fi
  fi
fi
echo ""
if [ "$rpcOpt" = "private" ]; then
  echo "RPC port will be accessible only on local interface. RPC calls from remote machines will be blocked."
fi
if [ "$rpcOpt" = "public" ]; then
  echo "WARNING: RPC port will be accessible publicly! You must set up access controls!"
fi
echo ""
if [ "$indexOpt" = "true" ]; then
  echo "Node indexing is enabled. Note that existing nodes need to bootstrap again to fill in the missing indexes."
  echo ""
fi
if [ "$archivalOpt" = "true" ]; then
  echo "Node pruning is disabled, node is running in archival mode."
  echo "Note that existing nodes need to bootstrap again to fill in the missing data."
  echo ""
fi
if [ "$stateOpt" = "?" ]; then
  echo "Bootstrapping the C-Chain can be done by downloading and replaying the whole chain history, which can take"
  echo "a lot of time (up to a week or more!), but populates the local database with complete state transitions."
  echo "Alternatively, node can bootstrap using state sync, to fetch only the latest chain state, which is much faster."
fi
while [ "$stateOpt" != "on" ] && [ "$stateOpt" != "off" ]
do
  read -p "Do you want state sync bootstrapping to be turned on or off? [on, off]: " stateOpt
done
if [ "$stateOpt" = "on" ]; then
  echo "State sync will be enabled. Node will not replay the whole C-Chain transaction history,"
  echo "instead it will only download the current chain state."
  echo ""
fi
if [ "$stateOpt" = "off" ]; then
  echo "State sync is disabled. Node will download and replay the whole C-Chain transaction history."
  echo ""
fi
if [ "$adminOpt" = "true" ]; then
  echo "Admin API on the node is enabled."
  echo ""
fi
if [ "$fujiOpt" = "true" ]; then
  echo "Node is connected to the Fuji test network."
  echo ""
fi
if [ "$dbdirOpt" != "no" ]; then
  echo "Node database directory is set to: $dbdirOpt"
  echo ""
fi
create_config_file
create_service_file
chmod 644 avalanchego.service
sudo cp -f avalanchego.service /etc/systemd/system/avalanchego.service
sudo systemctl daemon-reload
sudo systemctl start avalanchego
sudo systemctl enable avalanchego
echo
echo "Done!"
echo
echo "Your node should now be bootstrapping."
echo "Node configuration file is $HOME/.avalanchego/configs/node.json"
echo "C-Chain configuration file is $HOME/.avalanchego/configs/chains/C/config.json"
echo "Plugin directory, for storing L1 VM binaries, is $HOME/.avalanchego/plugins"
echo "To check that the service is running use the following command (q to exit):"
echo "sudo systemctl status avalanchego"
echo "To follow the log use (ctrl-c to stop):"
echo "sudo journalctl -u avalanchego -f"
echo
echo "Reach us over on https://chat.avax.network if you're having problems."
