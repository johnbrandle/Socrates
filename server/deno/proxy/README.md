-what is this for? it is supposed to serve as an intermediary between the worker api and this, but is probably unnecessary...just use a load balancer?
-also, ideally this would be a passthrough proxy

-commands: (see deno.jsonc)
deno task dev
deno task dev-compile
deno task prod
deno task certificate

-update deno using: https://formulae.brew.sh/formula/deno

-proxy.yaml contains the configuration you will use when compiling or running the server
-deno.jsonc contains the commands to run and create the executables (essentially equivelant to package.json)
-build.ts is a helper script used by deno.jsonc to copy files and create the proper command line string needed in deno.jsonc

-deno task web