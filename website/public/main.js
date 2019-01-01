window.onload = function () {
    blocks(done);
}

function blocks(cback) {
    httpRequest("/blocks.json", function (err, json) {
        array = JSON.parse(json); 
        /* Sample (multiline for visual only):
        [{"block":26535,"hash":"02245b6b58766b572773d36ddf19c1a59461937f61b543faf60c052022072690",
        "finder":"RE8ZCtMFxoaYo2N6AjPcmK2oq1GXtyjyZU.NewBeast","date":1545740761991},
        {"block":26536,"hash":"0440ed48b7fe1b8f50112f75f8f03af653d81a05d66f49c85f4ab6153aee7f1a",
        "finder":"RE8ZCtMFxoaYo2N6AjPcmK2oq1GXtyjyZU.NewBeast","date":1545740762066}] */
        var groupedByFinder = groupBy(array, 'finder');

        function finderInfoTable(cback) {
            var tablediv = document.getElementById('info'),
                table = document.createElement('table'),
                thead = document.createElement('thead'),
                tbody = document.createElement('tbody');
            table.className = 'table table-hover table-striped';
            var theadTR = document.createElement('tr');
            var theadTH1 = document.createElement('th');
            var theadTH3 = document.createElement('th');
            theadTH1.appendChild(document.createTextNode('Finder'));
            theadTH3.appendChild(document.createTextNode('Blocks'));
            theadTR.appendChild(theadTH1);
            theadTR.appendChild(theadTH3);
            thead.appendChild(theadTR);
            table.appendChild(thead);
            Object.keys(groupedByFinder).forEach(function (i) {
                var row = document.createElement("tr");
                var cell1 = document.createElement("td");
                var cell2 = document.createElement("td");
                cell1.appendChild(document.createTextNode(i))
                cell2.appendChild(document.createTextNode(groupedByFinder[i].length))
                row.appendChild(cell1);
                row.appendChild(cell2);
                tbody.appendChild(row)
                table.appendChild(tbody)
                tablediv.appendChild(table)
            });

            cback(null, "finderInfoTable()")
        }

        function blocksTable(cback) {
            var tablediv = document.getElementById('blocks'),
                table = document.createElement('table'),
                thead = document.createElement('thead'),
                tbody = document.createElement('tbody');
            table.className = 'table table-hover table-striped';
            var theadTR = document.createElement('tr');
            var theadTH1 = document.createElement('th');
            var theadTH2 = document.createElement('th');
            var theadTH3 = document.createElement('th');
            var theadTH4 = document.createElement('th');
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

            for (var i = array.length; i--;) {
                var row = document.createElement("tr");
                var cell1 = document.createElement("td");
                var cell2 = document.createElement("td");
                var cell3 = document.createElement("td");
                var cell4 = document.createElement("td");
                cell1.appendChild(document.createTextNode(array[i].block))
                cell2.appendChild(document.createTextNode(array[i].hash))
                cell3.appendChild(document.createTextNode(array[i].finder))
                var d = new Date(array[i].date);
                cell4.appendChild(document.createTextNode(d))
                row.appendChild(cell1);
                row.appendChild(cell2);
                row.appendChild(cell3);
                row.appendChild(cell4);
                tbody.appendChild(row)
                table.appendChild(tbody)
                tablediv.appendChild(table)
            };
            cback(null, "blocksTable()")
        }

        function createBlocksChart(data, cback) {
            var array = [];
            var svgwidth = 1000;
            var width = 360;
            var height = 360;
            var radius = Math.min(width, height) / 2;
            var color = d3.scaleOrdinal(d3.schemeCategory20c);
            Object.keys(data).forEach(function (i) {
                var obj = {};
                obj.label = i
                obj.value = data[i].length
                array.push(obj)
            });
            var legendRectSize = 18;
            var legendSpacing = 5;
            var svg = d3.select('#piechart')
                .append('svg')
                .attr('width', svgwidth)
                .attr('height', height)
                .append('g')
                .attr('transform', 'translate(' + (width / 2) + ',' + (height / 2) + ')');
            var arc = d3.arc()
                .innerRadius(0)
                .outerRadius(radius);
            var pie = d3.pie()
                .value(function (d) {
                    return d.value;
                })
                .sort(null);
            var path = svg.selectAll('path')
                .data(pie(array))
                .enter()
                .append('path')
                .attr('d', arc)
                .attr('fill', function (d, i) {
                    return color(d.data.label);
                });
            var legend = svg.selectAll('.legend')
                .data(color.domain())
                .enter()
                .append('g')
                .attr('class', 'legend')
                .attr('transform', function (d, i) {
                    var height = legendRectSize + legendSpacing;
                    var offset = height * color.domain().length / 2;
                    var horz = 12 * legendRectSize;
                    var vert = i * height;
                    return 'translate(' + horz + ',' + vert + ')';
                });
            legend.append('rect')
                .attr('width', legendRectSize)
                .attr('height', legendRectSize)
                .style('fill', color)
                .style('stroke', color);
            legend.append('text')
                .attr('x', legendRectSize + legendSpacing)
                .attr('y', legendRectSize - legendSpacing)
                .text(function (d, i) {
                    return array[i].label;
                });
            cback(null, "createBlocksChart(" + data + ")")
        }
        function createFindersChart(data, cback) {
            var links = [];
            var nodes = [];
            var bubbles = null;
            var width = 1000;
            height = 500;
            var svg = d3.select("#blockschart")
                .append("svg")
                .attr("width", width)
                .attr("height", height)
            Object.keys(data).forEach(function (i) { //Sort JSON to be usable in node/link fashion
                data[i].forEach(function (x, index) {
                    var obj = {};
                    obj.source = i;
                    obj.target = x.block;
                    links.push(obj)
                })
            });
            var nodeArr = links.map(function (d) { return [d.source, d.target] }).join().split(",");
            var uniqueNodeArr = nodeArr.filter(function (d, i) { return nodeArr.indexOf(d) == i });
            nodes = uniqueNodeArr.map(function (node, i) {
                return {
                    name: node
                };
            });

            var simulation = d3.forceSimulation()
                .nodes(nodes)
                .force("charge_force", d3.forceManyBody().distanceMax(100))
                .force("center_force", d3.forceCenter(width / 2, height / 2));
            var node = svg.append("g")
                .attr("class", "node")
                .selectAll("circle")
                .data(nodes)
                .enter()
                .append("circle")
                .attr("r", 5)
                .attr("fill", circleColor);
            function circleColor(d) {
                if (isNaN(d.name)) {
                    console.log(d.name)
                    return "blue";
                } else {
                    return "red";
                }
            }
            var link_force = d3.forceLink(links)
                .id(function (d) { return d.name; })
                .distance(30)

            simulation.force("links", link_force)
            var link = svg.append("g")
                .attr("class", "link")
                .selectAll("line")
                .data(links)
                .enter().append("line")

            function tickActions() {
                //update circle positions to reflect node updates on each tick of the simulation
                node
                    .attr("cx", function (d) { return d.x; })
                    .attr("cy", function (d) { return d.y; })

                link
                    .attr("x1", function (d) { return d.source.x; })
                    .attr("y1", function (d) { return d.source.y; })
                    .attr("x2", function (d) { return d.target.x; })
                    .attr("y2", function (d) { return d.target.y; });
            }
            simulation.on("tick", tickActions);
            simulation.force("links", link_force)
            cback(null, "createFindersChart(" + data + ")")
        }

        async.parallel([
            function (callback) { finderInfoTable(callback) },
            function (callback) { blocksTable(callback) },
            function (callback) { createBlocksChart(groupedByFinder, callback) },
            function (callback) { createFindersChart(groupedByFinder, callback) }
        ], function (err, results) {
            cback("blocks() which called " + results)
        });
    });
}

function httpRequest(req, cback) {
    var request = new XMLHttpRequest()
    request.open('GET', req);
    request.onload = function () {
        if (request.status >= 200 && request.status < 400) {
            var data = request.responseText;
            cback(null, data);
        } else {
            cback(request.status, null);
        }
    }
    request.onerror = function () { cback("Couldn't get the data :(", null); };
    request.send();
}

function groupBy(xs, key) {
    return xs.reduce(function (rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {})
}

function done(func) { console.log(func + " is done"); }
