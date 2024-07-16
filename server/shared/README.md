HTTP Server setup:

Option 1)
  Install:

    Load balancer using (Cloudflare, Fastly, or Digital Ocean)
    Have 2 or 3 different hosting providers, cheap, unlimited transfer (ideally), must support docker:
    Load balancers point to those ips, and there we go...

  Updates:

    Create a new docker image with the latest updates, push one by one, but not at the same time so they will be available at all times
    Include the latest web version they should be serving in the config, the version to upgrade to, and a timestamp on when to make it available
    as the default (simply an offset of the version number to upgrade to).

    Pros/cons: Assuming the load balancer can properly detect when a host goes down, this should provide 100% uptime and a seemless update path for the user.
    However, in order to update you will need to do a bit of work as far as getting the config correct, you will need to update the config, with the latest 
    version number (though, you may be able to do this automatically, so long as you only ever push one new build at a time... there may be more ways...).
    You will need to update the docker containers one at a time, using a different approach for each, a bit painful, but not too bad really. should be a cheap
    solution if you pick the right hosts.

    hosts i am currently interested in: fly.io (may be too expensive as they charge for bandwidth, but they have a free tier, and if you have enough hosts...)


