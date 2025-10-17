// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

// Global variables for coin info
let coinSymbol = 'KMD'; // Default fallback
let explorerBaseUrl = 'https://kmd.explorer.dexstats.info/block/'; // Default fallback

window.onload = function () {
    // First fetch coin info, then load blocks
    getCoinInfo(() => {
        blocks(done);
    });
};

function blocks(cback) {
    httpRequest('/blocks.json', (err, json) => {
        array = JSON.parse(json);
        /* Sample (multiline for visual only):
        [{"block":26535,"hash":"02245b6b58766b572773d36ddf19c1a59461937f61b543faf60c052022072690",
        "finder":"RE8ZCtMFxoaYo2N6AjPcmK2oq1GXtyjyZU.NewBeast","date":1545740761991},
        {"block":26536,"hash":"0440ed48b7fe1b8f50112f75f8f03af653d81a05d66f49c85f4ab6153aee7f1a",
        "finder":"RE8ZCtMFxoaYo2N6AjPcmK2oq1GXtyjyZU.NewBeast","date":1545740762066}] */
        const groupedByFinder = groupBy(array, 'finder');

        function finderInfoTable(data, cback) {
            const tablediv = document.getElementById('info'),
                table = document.createElement('table'),
                thead = document.createElement('thead'),
                tbody = document.createElement('tbody');
            table.className = 'table table-hover table-striped';
            const theadTR = document.createElement('tr');
            const theadTH1 = document.createElement('th');
            const theadTH3 = document.createElement('th');
            theadTH1.appendChild(document.createTextNode('Finder'));
            theadTH3.appendChild(document.createTextNode(`Blocks of ${data.length}`));
            theadTR.appendChild(theadTH1);
            theadTR.appendChild(theadTH3);
            thead.appendChild(theadTR);
            table.appendChild(thead);
            const groupedByFinder = groupBy(data, 'finder');
            Object.keys(groupedByFinder).forEach((i) => {
                const row = document.createElement('tr');
                const cell1 = document.createElement('td');
                const cell2 = document.createElement('td');
                cell1.appendChild(document.createTextNode(i));
                cell2.appendChild(document.createTextNode(groupedByFinder[i].length));
                row.appendChild(cell1);
                row.appendChild(cell2);
                tbody.appendChild(row);
                table.appendChild(tbody);
                tablediv.appendChild(table);
            });

            cback(null, 'finderInfoTable()');
        }

        function blocksTable(data, cback) {
            const tablediv = document.getElementById('blocks'),
                table = document.createElement('table'),
                thead = document.createElement('thead'),
                tbody = document.createElement('tbody');
            table.className = 'table table-hover table-striped';
            const theadTR = document.createElement('tr');
            const theadTH1 = document.createElement('th');
            const theadTH2 = document.createElement('th');
            const theadTH3 = document.createElement('th');
            const theadTH4 = document.createElement('th');
            theadTH1.appendChild(document.createTextNode('Block'));
            theadTH2.appendChild(document.createTextNode('Hash'));
            theadTH3.appendChild(document.createTextNode('Finder'));
            theadTH4.appendChild(document.createTextNode('Date'));
            theadTR.appendChild(theadTH1);
            theadTR.appendChild(theadTH2);
            theadTR.appendChild(theadTH3);
            theadTR.appendChild(theadTH4);
            thead.appendChild(theadTR);
            table.appendChild(thead);

            for (let i = data.length; i--;) {
                const row = document.createElement('tr');
                const cell1 = document.createElement('td');
                const cell2 = document.createElement('td');
                const cell3 = document.createElement('td');
                const cell4 = document.createElement('td');
                cell1.appendChild(document.createTextNode(data[i].block));
                cell2.appendChild(document.createTextNode(''));
                const link = document.createElement('a');
                link.href = explorerBaseUrl + data[i].hash;
                link.setAttribute('target', '_blank');
                link.innerText = data[i].hash;
                cell2.appendChild(link);
                cell3.appendChild(document.createTextNode(data[i].finder));
                const d = new Date(data[i].date);
                cell4.appendChild(document.createTextNode(d));
                row.appendChild(cell1);
                row.appendChild(cell2);
                row.appendChild(cell3);
                row.appendChild(cell4);
                tbody.appendChild(row);
                table.appendChild(tbody);
                tablediv.appendChild(table);
            };
            cback(null, 'blocksTable()');
        }

        function createBlocksChart(data, cback) {
            const array = [];
            const svgwidth = 1000;
            const width = 360;
            const height = 360;
            const radius = Math.min(width, height) / 2;
            const color = d3.scaleOrdinal(d3.schemeCategory20c);
            Object.keys(data).forEach((i) => {
                const obj = {};
                obj.label = i;
                obj.value = data[i].length;
                array.push(obj);
            });
            const legendRectSize = 18;
            const legendSpacing = 5;
            const svg = d3.select('#piechart')
                .append('svg')
                .attr('width', svgwidth)
                .attr('height', height)
                .append('g')
                .attr('transform', `translate(${width / 2},${height / 2})`);
            const arc = d3.arc()
                .innerRadius(0)
                .outerRadius(radius);
            const pie = d3.pie()
                .value((d) => {
                    return d.value;
                })
                .sort(null);
            const path = svg.selectAll('path')
                .data(pie(array))
                .enter()
                .append('path')
                .attr('d', arc)
                .attr('fill', (d, i) => {
                    return color(d.data.label);
                });
            const legend = svg.selectAll('.legend')
                .data(color.domain())
                .enter()
                .append('g')
                .attr('class', 'legend')
                .attr('transform', (d, i) => {
                    const height = legendRectSize + legendSpacing;
                    const offset = height * color.domain().length / 2;
                    const horz = 12 * legendRectSize;
                    const vert = i * height;
                    return `translate(${horz},${vert})`;
                });
            legend.append('rect')
                .attr('width', legendRectSize)
                .attr('height', legendRectSize)
                .style('fill', color)
                .style('stroke', color);
            legend.append('text')
                .attr('x', legendRectSize + legendSpacing)
                .attr('y', legendRectSize - legendSpacing)
                .text((d, i) => {
                    return array[i].label;
                });
            cback(null, `createBlocksChart(${data})`);
        }
        function createFindersChart(data, cback) {
            const links = [];
            let nodes = [];
            const bubbles = null;
            const width = 1000;
            height = 500;
            const svg = d3.select('#blockschart')
                .append('svg')
                .attr('width', width)
                .attr('height', height);
            Object.keys(data).forEach((i) => { //Sort JSON to be usable in node/link fashion
                data[i].forEach((x, index) => {
                    const obj = {};
                    obj.source = i;
                    obj.target = x.block;
                    links.push(obj);
                });
            });
            const nodeArr = links.map((d) => {
                return [d.source, d.target];
            }).join().split(',');
            const uniqueNodeArr = nodeArr.filter((d, i) => {
                return nodeArr.indexOf(d) == i;
            });
            nodes = uniqueNodeArr.map((node, i) => {
                return {
                    name: node
                };
            });

            const simulation = d3.forceSimulation()
                .nodes(nodes)
                .force('charge_force', d3.forceManyBody().distanceMax(100))
                .force('center_force', d3.forceCenter(width / 2, height / 2));
            const node = svg.append('g')
                .attr('class', 'node')
                .selectAll('circle')
                .data(nodes)
                .enter()
                .append('circle')
                .attr('r', 5)
                .attr('fill', circleColor);
            function circleColor(d) {
                if (isNaN(d.name)) {
                    console.log(d.name);
                    return 'blue';
                } else {
                    return 'red';
                }
            }
            const link_force = d3.forceLink(links)
                .id((d) => {
                    return d.name;
                })
                .distance(30);

            simulation.force('links', link_force);
            const link = svg.append('g')
                .attr('class', 'link')
                .selectAll('line')
                .data(links)
                .enter().append('line');

            function tickActions() {
                //update circle positions to reflect node updates on each tick of the simulation
                node
                    .attr('cx', (d) => {
                        return d.x;
                    })
                    .attr('cy', (d) => {
                        return d.y;
                    });

                link
                    .attr('x1', (d) => {
                        return d.source.x;
                    })
                    .attr('y1', (d) => {
                        return d.source.y;
                    })
                    .attr('x2', (d) => {
                        return d.target.x;
                    })
                    .attr('y2', (d) => {
                        return d.target.y;
                    });
            }
            simulation.on('tick', tickActions);
            simulation.force('links', link_force);
            cback(null, `createFindersChart(${data})`);
        }

        function getBlocks() {
            $.ajax({
                url: '/blocks.json',
                dataType: 'json',
                success: (data) => {
                    const groupedByFinder = groupBy(data, 'finder');
                    Promise.all([
                        new Promise(resolve => finderInfoTable(data, resolve)),
                        new Promise(resolve => blocksTable(data, resolve)),
                        new Promise(resolve => createBlocksChart(groupedByFinder, resolve)),
                        new Promise(resolve => createFindersChart(groupedByFinder, resolve))
                    ]).then(results => {
                        console.log('All functions finished:', results);
                    }).catch(err => {
                        console.error('Error in parallel execution:', err);
                    });
                },
                error: (xhr, status, err) => {
                    console.error('Error fetching blocks:', err);
                }
            });
        }

        getBlocks();
    });
}

function getCoinInfo(callback) {
    httpRequest('/coin-info', (err, json) => {
        if (!err && json) {
            try {
                const coinInfo = JSON.parse(json);
                coinSymbol = coinInfo.symbol || 'KMD';
                explorerBaseUrl = `https://${coinSymbol.toLowerCase()}.explorer.dexstats.info/block/`;
                console.log('Loaded coin info:', coinInfo.name, `(${coinSymbol})`);
                console.log('Explorer URL:', explorerBaseUrl);
            } catch (e) {
                console.warn('Failed to parse coin info, using defaults');
            }
        } else {
            console.warn('Failed to fetch coin info, using defaults');
        }
        callback();
    });
}

function httpRequest(req, cback) {
    const request = new XMLHttpRequest();
    request.open('GET', req);
    request.onload = function () {
        if (request.status >= 200 && request.status < 400) {
            const data = request.responseText;
            cback(null, data);
        } else {
            cback(request.status, null);
        }
    };
    request.onerror = function () {
        cback('Couldn\'t get the data :(', null);
    };
    request.send();
}

function groupBy(xs, key) {
    return xs.reduce((rv, x) => {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {});
}

function done(func) {
    console.log(`${func} is done`);
}
