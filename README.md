## Solomining proxy for Komodo. (READY FOR TESTING)

## The solo miner's solo pool
The objective is a "light-weight" pool that does what needs to be done.

## When all else fails: RTFM!

Requirements
------------
* node v11.5+ (installs by following "Install" below)
* coin daemon 

Install
-------------

```bash
sudo apt-get install build-essential libsodium-dev
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
source ~/.bashrc
curl -sL https://deb.nodesource.com/setup_11.x | sudo bash -
sudo apt-get install -y nodejs
sudo npm install npm -g
nvm install node
nvm alias default node
git clone https://github.com/TheComputerGenie/KMD-solo-mining
cd KMD-solo-mining
npm install && cd node_modules/express-dot-engine && npm install lodash@4.17.11 && cd ../..
```

Configure
-------------
Go to config.json and change it to your setup.

Run
------------
```bash
npm start
```

Update
------------- 
```bash
git pull
rm -rf node_modules
npm install && cd node_modules/express-dot-engine && npm install lodash@4.17.11 && cd ../..
```

Differences between this and Z-NOMP
------------
* This is meant for solo mining
* There is no share system; Every "share" is the block solution
* No payments
* NO equihashverify - While this pool will work with rentals (NiceHash checked at the time of publishing), it is intended
for the true solo miner, who needs no such protection against fake shares.

Notes and known issues:
------------
* (KI) VarDiff is broken.

* (N) If the code looks like it has 9 styles of writing, that because it does. It was a long journey from NOMP to here with
many hands in the jar and no "standard" of style. Over time, the base has become the spagetti that NOMP was written to
avoid, and over time that will be changed.

* (N KI) Web pages use online resources for css and some of the js. These min files are "standard", used on countless sites, 
can be checked at your discretion, and may or may not be localized at some future point.

* (N) There is no TLS functionality, because I'm not sure I could ever be convinced of need for a solo setup.

License
-------
Released under the GNU General Public License 3
http://www.gnu.org/licenses/gpl-3.0.html

_Forked from [aayanl/equihash-solomining](https://github.com/aayanl/equihash-solomining) which is licensed under GNU GPL v2_
