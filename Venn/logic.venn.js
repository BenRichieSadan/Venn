/**
 * Venn main logic file
 * Developed By: Ben Richie Sadan @ Sisense
 * Version : 1.0.0
 */

function createRequestHeaders() {
    var myHeaders = new Headers();
    let bearerVal = document.cookie.replace("XSRF-TOKEN=", "Bearer ");
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authentication", bearerVal);

    return myHeaders;
}

async function fetchQuery(dataSourceTitle, jaql) {
    var myHeaders = createRequestHeaders();

    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        redirect: "follow",
        body: JSON.stringify(jaql)
    };

    let url =
        "/api/datasources/" +
        dataSourceTitle +
        "/jaql?skipPermissions=false";

    let response = await fetch(url, requestOptions).then(async function (response) {
        return myJson = response.json();
    });

    var fullQueriesResults = [];

    if (response.metadata && response.metadata.length > 0) {
        let curWidget = prism.activeDashboard.widgets.get(response.metadata[0].callInfo.widgetID);

        if(prism.activeWidget){
            curWidget = prism.activeWidget;
        } else {
            curWidget = prism.activeDashboard.widgets.get(response.metadata[0].callInfo.widgetID);
        }

        if (curWidget.lastQueryTime == response.metadata[0].callInfo.Time) {
            for (let resultIndex = 0; resultIndex < response.metadata.length; resultIndex++) {
                let members = [];

                let filterObj = response.metadata[resultIndex].context["[filter]"].filter;

                if (filterObj.and != null) {
                    members = filterObj.and[0].contains.split(',');
                } else {
                    members = filterObj.or[0].equals.split(',');
                }

                let qDataObj = {
                    sets: members,
                    size: response.values[resultIndex]
                }

                fullQueriesResults.push(qDataObj);
            }

            clearLoading(response.metadata[0].callInfo.widgetID);

            drawVenn({
                widgetID: response.metadata[0].callInfo.widgetID,
                data: fullQueriesResults
            });
        }
    }

    return response;
}

function createNewJaqlTemplate(titleVal, datasource, targetDimention, measurmentDim) {
    let sampleJaql = {
        title: titleVal,
        type: "measure",
        formula: "([measure],[filter])",
        context: {
            "[filter]": {
                table: targetDimention.jaql.table,
                column: targetDimention.jaql.column,
                dim: targetDimention.jaql.dim,
                datatype: targetDimention.jaql.datatype,
                merged: true,
                filter: {},
                collapsed: false,
                title: targetDimention.jaql.title,
                datasource: datasource
            },
            "[measure]": measurmentDim.jaql
        }
    };

    return sampleJaql;
}

function generateAndJaql(containList, doseNotContainList) {
    let template = {
        "and": [{
                "contains": "Dairy"
            },
            {
                "contains": "Bread"
            },
            {
                "doesntContain": "Fruit"
            }
        ],
        "custom": true
    };

    let andArr = [];

    containList.forEach(curMem => {
        andArr.push({
            "contains": curMem
        });
    });

    doseNotContainList.forEach(curMem => {
        andArr.push({
            "doesntContain": curMem
        });
    });

    template.and = andArr;

    return template;
}

function getPermutations(xs) {
    let ret = [];

    for (let i = 0; i < xs.length; i = i + 1) {
        let rest = getPermutations(xs.slice(0, i).concat(xs.slice(i + 1)));

        if (!rest.length) {
            ret.push([xs[i]])
        } else {
            for (let j = 0; j < rest.length; j = j + 1) {
                ret.push([xs[i]].concat(rest[j]))
            }
        }
    }
    return ret;
}

function generateORJaql(containList) {
    let template = {
        "or": [{
                "equals": "Dairy,Bread,Fruit"
            },
            {
                "equals": "Fruit,Dairy,Bread"
            }
        ],
        "custom": true
    };

    let permu = getPermutations(containList);

    let orArr = [];

    permu.forEach(curMem => {
        orArr.push({
            "equals": curMem.toString()
        });
    });

    template.or = orArr;

    return template;
}

function getCombinations(values) {
    var result = [];
    var f = function (prefix, values) {
        for (var i = 0; i < values.length; i++) {
            let divider = '';
            if (prefix != '') {
                divider = ',';
            }

            result.push(prefix + divider + values[i]);
            f(prefix + divider + values[i], values.slice(i + 1));
        }
    }
    f('', values);
    return result;
}

function queryForVenn(widget, config) {
    addLoadingToDiv(config.widgetID);

    let mainJaql = getVennJaql(config);

    if (widget.venActiveFilters && widget.venActiveFilters.length > 0) {
        widget.venActiveFilters.forEach(curFilter => {
            if (mainJaql.metadata.length < 32) {
                mainJaql.metadata.push(curFilter);
            }
        });
    }

    widget.lastQueryTime = mainJaql.metadata[0].callInfo.Time;

    fetchQuery(mainJaql.datasource, mainJaql);
}

function getVennJaql(config) {
    let mainJaql = {
        datasource: config.datasource,
        metadata: []
    };

    let dimNames = [];

    config.rows.forEach(curRow => {
        dimNames.push(curRow.text);
    });

    let combi = getCombinations(dimNames);

    combi.forEach(curComb => {
        let combSplit = curComb.split(',');
        let title = '';

        let Jaql;

        if (combSplit.length > 1) {
            title = 'Equals:';
            Jaql = generateORJaql(combSplit);
        } else {
            title = 'All with:';
            Jaql = generateAndJaql(combSplit, []);
        }

        title += curComb;

        let HolderJaql = createNewJaqlTemplate(title, config.datasource, config.targetDim, config.valuePanel);

        HolderJaql.context["[filter]"].filter = Jaql;

        mainJaql.metadata.push(HolderJaql);
    });

    mainJaql.metadata[0].callInfo = {
        widgetID: config.widgetID,
        Time: Date.now()
    };

    return mainJaql;
}

function addLoadingToDiv(widgetID) {
    let dotsHolder = document.createElement("div");
    dotsHolder.className = "loading-dots";

    for (let index = 0; index < 3; index++) {
        let dotElm = document.createElement("div");
        dotElm.className = "loading-dot";

        dotsHolder.append(dotElm);
    }

    dotsHolder.style.position = "relative";
    dotsHolder.style.top = "50%";
    dotsHolder.style.margin = "auto";

    let holder = $("#venn" + widgetID);

    holder.append(dotsHolder);
}

function clearLoading(widgetID) {
    let holder = $("#venn" + widgetID);
    holder.empty();
}

function getNextQuery(startIndex, gatherLength, skipAfterStart, dimentions) {
    let contDims = [];
    let pastDims = [];
    let skippedDims = [];
    let nextDims = [];

    if (skipAfterStart == 0) {
        contDims = dimentions.slice(startIndex, startIndex + gatherLength);
    } else {
        contDims.push(dimentions[startIndex]);
        contDims = contDims.concat(dimentions.slice(startIndex + 1 + skipAfterStart, startIndex + 1 + skipAfterStart + gatherLength));
    }

    if (startIndex > 0) {
        pastDims = pastDims.concat(dimentions.slice(0, startIndex));
    }

    if (skipAfterStart == 0) {
        if ((startIndex + gatherLength) < dimentions.length) {
            nextDims = dimentions.slice(startIndex + gatherLength, dimentions.length)
        }
    } else {
        if ((startIndex + 1 + skipAfterStart + gatherLength) < dimentions.length) {
            nextDims = dimentions.slice(startIndex + 1 + skipAfterStart + gatherLength, dimentions.length)
        }

        skippedDims = dimentions.slice(startIndex + 1, startIndex + 1 + skipAfterStart);
    }

    let notContDims = pastDims.concat(nextDims).concat(skippedDims);

    let Jaql = createNewJaqlTemplate([]);

    Jaql.title = contDims.toString();

    Jaql.context["[filter]"].filter = generateORJaql(contDims);

    return Jaql;
}

function drawVenn(config) {
    let elementSpace = document.getElementById("venn" + config.widgetID);

    var chart = venn.VennDiagram()
        .height(elementSpace.clientHeight)
        .width(elementSpace.clientWidth);

    var div = d3.select(elementSpace);
    div.datum(config.data).call(chart);

    var tooltip = d3.select(elementSpace).append("div")
        .attr("class", "venntooltip");

    div.selectAll("path")
        .style("stroke-opacity", 0)
        .style("stroke", "#fff")
        .style("stroke-width", 3);

    let undisplayedAreas = document.createElement('div');
    undisplayedAreas.className = 'undisplayedAreasDiv';
    undisplayedAreas.innerText = 'Undisplayed Areas: ';

    let hasUndisplayedAreas = false;

    config.data.forEach(curData => {
        if (curData.isDisplayed == false) {
            undisplayedAreas.innerText += '\n' + curData.sets.toString() + ' ' + curData.size;
            hasUndisplayedAreas = true;
        }
    });

    if (hasUndisplayedAreas) {
        elementSpace.append(undisplayedAreas);
    }

    div.selectAll("g")
        .on("mouseover", function (d, i) {
            // sort all the areas relative to the current item
            venn.sortAreas(div, d);

            // Display a tooltip with the current size
            tooltip.transition().duration(400).style("opacity", .9);
            let tooltipText = '';

            if (d.sets.length == 1) {
                tooltipText = 'All with ';
            } else {
                tooltipText = 'Equals ';
            }

            for (let index = 0; index < d.sets.length; index++) {
                let curSet = d.sets[index];
                if (index > 0) {
                    tooltipText += ' & ';
                }

                tooltipText += curSet;
            }

            tooltipText += ': ' + d.size;


            tooltip.text(tooltipText);

            // highlight the current path
            var selection = d3.select(this).transition("tooltip").duration(400);
            selection.select("path")
                .style("fill-opacity", d.sets.length == 1 ? .4 : .1)
                .style("stroke-opacity", 1);
        })
        .on("mousemove", function () {
            let leftPoint = d3.event.layerX;
            let tooltipWidth = tooltip._groups[0][0].getBoundingClientRect().width;

            if (leftPoint > tooltipWidth) {
                leftPoint -= tooltipWidth;
            }

            tooltip.style("left", (leftPoint) + "px")
                .style("top", (d3.event.layerY - 28) + "px");
        })
        .on("mouseout", function (d, i) {
            tooltip.transition().duration(400).style("opacity", 0);
            var selection = d3.select(this).transition("tooltip").duration(400);
            selection.select("path")
                .style("fill-opacity", d.sets.length == 1 ? .25 : .0)
                .style("stroke-opacity", 0);
        });
}