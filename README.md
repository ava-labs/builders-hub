# Avalanche Builder Hub

<div align="center">
  <img src="public/logo.png?raw=true">
</div>

## Overview

This repository contains the contents for the Avalanche Builder Hub. It hosts the Docs, the
Avalanche Academy and the integrations directory and is deployed at [https://build.avax.network/docs](https://build.avax.network/docs).

## Contributing

Contributing to the Avalanche Builder Hub is a great way to get involved with the Avalanche dev community!
Here's how to get started:

### Quick Fixes

For small typos or corrections, it is easy to contribute without the need to clone/fork the
repository. Simply:

- Find the page you want to edit.
- Click the "Edit on GitHub" button in the right sidebar
- Make the changes and Hit "Commit changes ..."
- Edit the `commit message` to describe the change in 4 or less words, and include any extra details in the description
- Hit "Sign off and commit changes" to raise a PR with your proposed changes

### New Content or Extensive Changes

To propose new docs or large edits to our existing pages, follow the steps accordingly:

- **Ava Labs Github Organization Members:** Clone the repo
  `git clone https://github.com/ava-labs/builders-hub.git`
- **External Contributors:** Fork the repo via GitHub's GUI
- Checkout to a new branch `git checkout -b <your-name/branch-name>`
- Make changes on your branch
- `git add .`
- **`yarn dev` to ensure the build passes**
- `git commit -m "some commit message"`
- `git push`
- Head to [GitHub](https://github.com/ava-labs/builders-hub) and open a new pull request

### Structure and Syntax

- Docs are located in the [docs](content/docs) directory.
- Our style guide can be found [here](style-guide.md).
- All image files should be included under [public images folder](public/images).

### Pull Request (PR)

- All PRs should be made against the `master` branch.
- Following a successful build, Vercel will deploy your branch where you can verify your changes.
- Once your PR is merged into `master`, [https://build.avax.network/docs/](https://build.avax.network/docs/) will be updated with your changes.

### Installation

```bash
yarn install
```

### Local Development

```bash
yarn run start
```

This command starts a local development server and opens up a browser window. Most changes are
reflected live without having to restart the server.

### Build

```bash
next build
```

This command generates static content into the `.next` directory and can be rendered using Next server.

## New or Missing Content Requests

_The information I am requesting is related to a specific project, i.e. AvalancheGo, AvalancheNetworkRunner, etc.:_

- Please raise a **Missing Docs Issue** in the GitHub repository of that project and
  thoroughly detail your request. Include references to any existing pages relevant to your
  request.

_The information I am requesting is explanatory in nature and does not currently exist:_

- Please open a new [Issue](https://github.com/ava-labs/builders-hub/issues/new/choose)
  in this repository and thoroughly detail your request according to the issue template.
  If urgent, please create a new ticket in the
  [Dev Docs Improvement Proposals](https://github.com/orgs/ava-labs/projects/15/views/1)
  dashboard.

_Erroneous or missing information on documentation unrelated to a specific project needs
editing:_

- If you understand the issue enough to provide a correction, follow the steps
  [here](https://github.com/ava-labs/builders-hub#quick-fixes).
- If not, please raise an [Issue](https://github.com/ava-labs/builders-hub/issues/new/choose).
