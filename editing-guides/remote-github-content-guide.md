# Docs Imported Directly from GitHub Repos

Some pages, such as
[Teleporter Overview](https://build.avax.network/docs/build/cross-chain/teleporter/overview),
are maintained as MarkDown files directly in their respective GitHub repo, and imported into the docs.
This is accomplished using a community-owned docusaurus plugin called [docusaurus-plugin-remote-content](https://github.com/rdilweb/docusaurus-plugin-remote-content?tab=readme-ov-file#docusaurus-plugin-remote-content). This guide goes into detail about how this is accomplished and how to maintain it.

## Requirements and Caveats

- Each file imported in this matter **must be added** to the .gitignore to avoid storing directly in the builders-hub repository, and formatting/conflict issues.
- All links included in imported files **must be tested**. For troubleshooting, see [The replaceRelativeLinks Function](#the-replacerelativelinks-function) section.
- Markdown ([.md]) docs are imported _in their entirety._ Importing a single subsection or excluding certain information _is not possible._
- These docs _by default_ will not be able to be translated by the github-translation-bot we employ.

## Primary Files

### [remoteContent.js](configs/remoteContent.js)

- Where the magic happens.

### [docusaurus.config.js](/docusaurus.config.js)

- The control tower for this site. There, you will find this line below which effectively evokes all of `remoteContent.js` when our application is built.

```js
const config = {
  plugins: [...remoteContent],
```

### [.gitignore](/.gitignore)

- See the first requirement [above](#requirements-and-caveats).

### [sidebars.json](/sidebars.json)

- Imported files need a path to go in. This file's function is essentially to pull .md files from the [docs]() directory and host them on our site. See [this](#outdir) comment for specifics.

### [package.json](/package.json)

- This plugin is included as a dependency here.

## How `remoteContent.js` Works

There are two main components to this:

1. The `remoteContent` array object
2. The `replaceRelativeLinks` function

### The `remoteContent` Array Object

Each of the arrays within this object will look like the following (based on the [docs](https://github.com/rdilweb/docusaurus-plugin-remote-content?tab=readme-ov-file#alright-so-how-do-i-use-this) from the creator of this plugin):

```js
[
    "docusaurus-plugin-remote-content",
    {
      //docs/build/cross-chain/awm/deep-dive.md
      name: "awm-overview",
      sourceBaseUrl:
        "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/warp/",
      documents: ["README.md"],
      outDir: "docs/build/cross-chain/awm/",
      // change file name and add metadata
      modifyContent(filename, content) {
        if (filename.includes("README")) {
          const updatedContent = replaceRelativeLinks(
            content,
            "https://github.com/ava-labs/avalanchego/tree/master/vms/platformvm/warp/"
          );
          return {
            filename: "deep-dive.md",
            content: `---
tags: [Avalanche Warp Messaging, AWM, cross-Avalanche L1 Communication, Cross-Chain Communication]
description: Avalanche Warp Messaging (AWM) provides a primitive for cross-Avalanche L1 communication on the Avalanche Network.
keywords: [ docs, documentation, avalanche, awm, cross-Avalanche L1 communication, cross-chain, cross-chain communication ]
sidebar_label: Deep Dive
---

${updatedContent}`,
          };
        }
        return undefined;
      },
    },
  ],
```

The first line with the plugin's title is required to invoke the plugin to process the options in the object following. The options are all defined by the plugin maintainer [here](https://github.com/rdilweb/docusaurus-plugin-remote-content?tab=readme-ov-file#options).

#### `name`

(_Required_) `string`

The name of this plugin instance. Must be unique.

#### `sourceBaseUrl`

(_Required_) `string`

The base URL that your remote docs are located. **Must be a raw.githubusercontent.com filepath**
All the IDs specified in the `documents` option will be resolved relative to this.
For example, if you have 2 docs located at `https://example.com/content/hello.md` and `https://example.com/content/thing.md`,
the `sourceBaseUrl` would need to be set to `https://example.com/content/`.

#### `documents`

(_Required_) `string[]` or `Promise<string[]>`

The documents to fetch. Must be file names (e.g. end in `.md`)
Following the previous example, if you had set `sourceBaseUrl` to `https://example.com/content/`,
and wanted to fetch thing.md and hello.md, you would just set `documents` to `["hello.md", "thing.md"]`

#### `outDir`

(_Required_) `string`

The folder to emit the downloaded content to. This should be included in `sidebars.json` if not already.

#### `modifyContent` function

A complex function that alters the content from it's source destination before it is included in the build of the site. Created by the plugin maintainer and is documented [here](https://github.com/rdilweb/docusaurus-plugin-remote-content?tab=readme-ov-file#modifycontent). Specifics explained in detail in the next section.

### The `replaceRelativeLinks` Function

This function at the top of the file was created to correct relative links located in the source files so that it would not lead docs users to a non existent page. It is a helper function nested within the [`modifyContent`](https://github.com/rdilweb/docusaurus-plugin-remote-content?tab=readme-ov-file#modifycontent) function.

It works by:

1. Looking for all relative links within the content of the [sourceBaseUrl](#sourcebaseurl)
2. Replacing them with absolute links based on the second argument given to the function. In the content block below, the new base is given as `https://github.com/ava-labs/avalanchego/tree/master/vms/platformvm/warp/`.

**Note:** Yes, this will link the user to Github. This is _by design_. If we wanted to redirect the user to another part of the docs site,
**every .md in every one of our external GH repos would need to have the exact file structure as their files appear in the docs**.
The overhead to maintain this would basically negate the purpose of this plugin.

```js
modifyContent(filename, content) {
        if (filename.includes("README")) {
          const updatedContent = replaceRelativeLinks(
            content,
            "https://github.com/ava-labs/avalanchego/tree/master/vms/platformvm/warp/"
          );
          return {
            filename: "deep-dive.md",
            content: `---
tags: [Avalanche Warp Messaging, AWM, cross-Avalanche L1 Communication, Cross-Chain Communication]
description: Avalanche Warp Messaging (AWM) provides a primitive for cross-Avalanche L1 communication on the Avalanche Network.
keywords: [ docs, documentation, avalanche, awm, cross-Avalanche L1 communication, cross-chain, cross-chain communication ]
sidebar_label: Deep Dive
sidebar_position: 1
---

${updatedContent}`,
          };
        }
        return undefined;
      },
```

`modifyContent` includes two fields:

1. `filename`: the new file name for the imported file.
2. `content`: the new file's contents.

- This includes the [docusaurus frontmatter](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs#markdown-front-matter) including
  [tags](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs#tags),
  [description](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs#description),
  [keywords](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs#keywords),
  [sidebar_label](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs#sidebar_label),
  [sidebar_position](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs#sidebar_position).
  **This is mandatory** and custom for each document.
  Note: If the imported file does not have an `h1` element (in Markdown this is the first level title, like #Overview, with only one hashtag), this can be included as frontmatter with [title](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs#title).

- `${updatedContent}` is where the content is inserted after it is modified by the `replaceRelativeLinks` function.

## Workflow

1. Copy an existing array element, and add it as an element in the `remoteContentArray` object.
2. Edit the fields per the instructions in the previous sections
3. Add the complete file path to `.gitignore`
4. Make sure the new file is included in `sidebars.json`
5. Run `yarn start` and ensure there aren't any warnings in the terminal
6. View in `localhost:3000`
