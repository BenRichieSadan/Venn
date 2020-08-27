/**
 * Venn main widget file
 * Developed By: Ben Richie Sadan @ Sisense
 * Version : 1.0.0
 */
prism.registerWidget('Venn', {
    name: 'Venn',
    family: "Chart",
    title: 'Venn',
    iconSmall: "/plugins/" + 'Venn' + "/" + 'Venn' + "-icon-small.png",
    styleEditorTemplate: "/plugins/" + 'Venn' + "/styler.html",
    hideNoResults: true,

    directive: {
        desktop: 'Venn'
    },
    style: {
        isRoundStrokes: true
    },
    data: {
        selection: [],
        defaultQueryResult: {},
        panels: [{
                name: 'Dimentions',
                type: "visible",
                metadata: {
                    types: ['dimensions'],
                    maxitems: 1
                },
                visibility: true
            }, {
                name: 'Target Dimention',
                type: "visible",
                metadata: {
                    types: ['dimensions'],
                    maxitems: 1
                },
                visibility: true
            }, {
                name: 'Value',
                type: "visible",
                metadata: {
                    types: ['measures'],
                    maxitems: 1
                },
                visibility: true
            },
            {
                name: 'filters',
                type: 'filters',
                metadata: {
                    types: ['dimensions'],
                    maxitems: -1
                }
            }
        ],

        // builds a jaql query from the given widget
        buildQuery: function (widget) {

            // building jaql query object from widget metadata 
            var query = {
                datasource: widget.datasource,
                format: "json",
                isMaskedResult: true,
                metadata: []
            };

            widget.targetDim = null;
            widget.mainDim = null;
            widget.valuePanel = null;

            if (widget.metadata.panel("Target Dimention").items.length > 0) {

                widget.targetDim = widget.metadata.panel("Target Dimention").items[0];

                if (widget.metadata.panel("Dimentions").items.length > 0) {
                    widget.metadata.panel("Dimentions").items.forEach(valueItem => {
                        query.metadata.push(valueItem);
                        widget.mainDim = valueItem;
                    });
                };

                if (widget.metadata.panel("Value").items.length > 0) {
                    widget.metadata.panel("Value").items.forEach(valueItem => {
                        widget.valuePanel = valueItem;
                    });
                };

                // pushing filters
                if (defined(widget.metadata.panel("filters"), 'items.0')) {
                    widget.metadata.panel('filters').items.forEach(function (item) {
                        item = $$.object.clone(item, true);
                        item.panel = "scope";
                        query.metadata.push(item);
                    });
                }
            }

            return query;
        }
    },
    beforequery: function (widget, event) {
        widget.venActiveFilters = [];

        for (let index = 0; index < event.query.metadata.length; index++) {
            let curElm = event.query.metadata[index];

            if (curElm.panel && curElm.panel == 'scope') {
                if (curElm.jaql.dim != widget.mainDim.jaql.dim) {
                    widget.venActiveFilters.push(curElm);

                    event.query.metadata.splice(index, 1);
                    index--;
                }
            } else if (curElm.jaql.dim == widget.targetDim.jaql.dim) {
                event.query.metadata.splice(index, 1);
                index--;
            }
        }
    },
    render: function (widget, event) {
        // 	Get widget element, and clear it out
        var element = $(event.element);
        element.empty();

        if (widget.targetDim != null) {
            if (widget.rawQueryResult.values.length > 5) {
                let errorMsg = document.createElement('h1');
                errorMsg.innerText = 'More than 5 dimensions selected, taking 5';
                errorMsg.style.textAlign = 'center';

                element.append(errorMsg);
            }

            let div = document.createElement('div');
            div.style.width = '100%';
            div.style.height = '100%';
            div.id = "venn" + widget.oid;

            element.append(div);

            let dataToUse = {
                widgetID: widget.oid,
                rows: [],
                datasource: widget.datasource,
                targetDim: widget.targetDim,
                valuePanel: widget.valuePanel
            };

            let numToCollect = 5;

            if (widget.rawQueryResult.values.length < 5) {
                numToCollect = widget.rawQueryResult.values.length;
            }

            for (let index = 0; index < numToCollect; index++) {
                let curElm = widget.rawQueryResult.values[index];

                dataToUse.rows.push(curElm[0]);
            }

            queryForVenn(widget, dataToUse);
        } else {
            let errorMsg = document.createElement('h1');
            errorMsg.innerText = 'Missing Target Dim!';

            element.append(errorMsg);
        }
    },
    options: {
        dashboardFiltersMode: "slice",
        selector: false,
        title: false
    }
});