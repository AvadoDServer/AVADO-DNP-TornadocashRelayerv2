
# Release new verions

- `dappnodesdk increase patch`
- `dappnodesdk build --provider http://23.254.227.151:5001`
- `git add dappnode_package.json docker-compose.yml releases.json`
- `git commit -m"new release"`
- `git push`
- `npx release-it`

