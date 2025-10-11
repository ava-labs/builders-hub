# Guide d’installation d’un nœud AvalancheGo sur Debian/Ubuntu

## 📋 Prérequis

- Un serveur Debian ou Ubuntu (testé sur Ubuntu 22.04 et Debian 12)
- Accès sudo / root
- `git` et `curl` installés
- Architecture x86_64 (CPU 64 bits)

---

## 🧰 Étape 1 : Installation des dépendances

```bash
sudo apt update && sudo apt install -y build-essential git curl
```

---

## 📥 Étape 2 : Télécharger AvalancheGo

```bash
git clone https://github.com/ava-labs/avalanchego.git
cd avalanchego
```

---

## ⚙️ Étape 3 : Compilation

```bash
./scripts/build.sh
```

> Cela va compiler le binaire `build/avalanchego`.

---

## 🚀 Étape 4 : Lancer le nœud

```bash
./build/avalanchego
```

Tu devrais voir des logs dans le terminal avec des messages du type :

```
INFO [0000] Initializing node
INFO [0001] Node ID: ...
```

---

## 🔁 Étape 5 : Démarrage en arrière-plan (optionnel)

Tu peux utiliser `screen`, `tmux` ou créer un service systemd :

### Exemple avec `screen`

```bash
screen -S avalanche
./build/avalanchego
```

> Tu peux détacher l'écran avec `Ctrl + A`, puis `D`

---

## 🧪 Étape 6 : Vérifier que ton nœud fonctionne

Dans un autre terminal :

```bash
curl -s http://localhost:9650/ext/info | jq
```

Tu devrais voir une réponse JSON avec les infos de ton nœud (`nodeID`, `version`, etc.)

---

## ⚠️ Ports à ouvrir sur ton pare-feu (ufw)

```bash
sudo ufw allow 9651/tcp
sudo ufw allow 9650/tcp
```

---

## 📝 Notes

- La configuration par défaut stocke les données dans `~/.avalanchego`
- Tu peux personnaliser le comportement avec un fichier `config.json`

Exemple :

```json
{
  "network-id": "mainnet",
  "log-level": "info"
}
```

Place ce fichier dans `~/.avalanchego/config.json`

---

## 📚 Ressources

- Docs officielles : [https://docs.avax.network](https://docs.avax.network)
- Support : [https://discord.gg/avalanche](https://discord.gg/avalanche)

