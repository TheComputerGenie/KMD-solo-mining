# Currently a Work-In-Progress (WIP)
Do not use in its current state!<br />
Updates are in progress.
<br />
<br />
<br />
<br />
<br />
<br />
<br />
<br />
<br />
<br />

## Solomining proxy for Komodo. ~~(READY FOR TESTING)~~

## The solo miner's solo pool
The objective is a "light-weight" pool that does what needs to be done.

## When all else fails: RTFM!

Requirements
------------
* node v21.4+ (installs by following "Install" below)
* coin daemon 

Install (Ubuntu)
-------------
Yes, this is "a lot" for beginners to understand; however, solo mining isn't meant to be easy.

```shell
sudo apt-get update
sudo apt-get install build-essential libsodium-dev

sudo apt-get install -y ca-certificates curl gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
NODE_MAJOR=21
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt-get update
sudo apt-get install nodejs -y

sudo npm install npm -g

git clone https://github.com/TheComputerGenie/KMD-solo-mining
cd KMD-solo-mining
npm install
```

Configure
-------------
Go to config.json and change it to your setup.

Recomended diffs:
-------------
GPU: 300
Minis: 3000
Large ASICs: 30000
Rentals: 1350000

Run
------------
```bash
npm start
```

Update (normally)
------------- 
```bash
git pull
```

Update (including any module changes )
------------- 
```bash
git pull
rm -rf node_modules
npm install
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
