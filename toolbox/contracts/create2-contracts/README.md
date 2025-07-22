# Create2 Contracts Compilation

This directory contains scripts to compile the Create2Deployer contract from the [pcaversaccio/create2deployer](https://github.com/pcaversaccio/create2deployer) repository.

## Usage

Run the compilation script:
```bash
./compile.sh
```

This will:
1. Clone the create2deployer repository
2. Install Foundry (if not already installed)
3. Compile the Create2Deployer contract
4. Extract the compiled JSON artifacts to the `compiled/` directory 