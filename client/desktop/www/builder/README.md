# **Compiles the source code using webpack**

##### July 31st 2023

Why does this exist? Because the builder code was becoming too complicated, especially given that it compiles the web workers, inline, loader, preloader, code as well. By moving this into its own folder, we can also seperate the dev dependencies.

## Overview

There are two commands:

- npm run dev (executes config.dev.ts)
- npm run prod (executes config.prod.ts)

Dev will watch for source code changes, and compile the associated target. Each compilation target has a pre, build, and post stage. Pre, do things before the build, build to build, and post to do things after the build. Pre and post are performed in a target order, but build is not. So, if both Loader and App need to compile, Loader's pre will run first, then App's pre, then both will compile simultaniously, then Loader's post will run, then App's post. This is because targets lower in the chain may be counting on modifications to be made by previous targets before their pre/post runs. The "app" target is the most complicated target, as it peforms a lot of pre/post processing, and is currently the last target in the chain.

Prod will obfuscate code, and generate a random 'etag' value. This is used for versioning, and is a epoch timestamp in seconds. Dev always uses "1234567890". If an '--out' param is specified when running npm run..., the build will be deployed to that folder, inside a folder with the generated etag number. Why? Because now we can seemlessly upgrade users from one version to another without breaking anything (the user could get invalid checksum errors if they pulled an assortment of old/new files).
