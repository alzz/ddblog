/**
 * @file
 * dd3blog bubble chart.
 */

(function ($, Drupal) {
  'use strict';

  Drupal.behaviors.ddblog_bubble_chart = {
    attach: function (context, settings) {
      $('#chart', context).once('ddblog-bubble-chart').each(function() {

        function bubbleChart() {
          // Sizing.
          var width = 1400;
          var height = 750;

          // Tooltip for mouseover functionality.
          var tooltip = floatingToolTip('dd3blog_tooltip', 240);

          // Locations to move bubbles towards, depending on which view mode
          // is selected.
          var center = {
            x: width / 2,
            y: height / 2
          };

          // @TODO: calcular donde poner cada sección.
          var typeCenters = {
            'access denied': { x: 220, y: height / 2 },
            'cron': { x: 375, y: height / 2 },
            'page not found': { x: 600, y: height / 2 },
            'php': { x: 800, y: height / 2 },
            'system': { x: 1000, y: height / 2 },
            'user': { x: 1200, y: height / 2 }
          };

          var typesTitleX = {
            'access denied': 75,
            'cron': 300,
            'page not found': 600,
            'php': 850,
            'system': 1125,
            'user': 1300
          };

          var severityCenters = {
            'Emergency': { x: 250, y: 200 },
            'Alert': { x: 500, y: 200 },
            'Critical': { x: 800, y: 200 },
            'Error': { x: 1100, y: 200 },
            'Warning': { x: 250, y: 500},
            'Notice': { x: 500, y: 500},
            'Info': { x: 800, y: 500},
            'Debug': { x: 1100, y: 500}
          };

          var severitiesTitlePosition = {
            'Emergency': { x: 150, y: 40 },
            'Alert': { x: 450, y: 40 },
            'Critical': { x: 850, y: 40 },
            'Error': { x: 1200, y: 40 },
            'Warning': { x: 150, y: 400 },
            'Notice': { x: 450, y: 400 },
            'Info': { x: 850, y: 400 },
            'Debug': { x: 1200, y: 400 }
          };

          // @v4 strength to apply to the position forces.
          var FORCE = 0.03;
          var forceStrength = FORCE;

          // These will be set in create_nodes and create_vis
          var svg = null;
          var bubbles = null;
          var nodes = [];

          // Charge function that is called for each node.
          // As part of the ManyBody force.
          // This is what creates the repulsion between nodes.
          //
          // Charge is proportional to the diameter of the
          // circle (which is stored in the radius attribute
          // of the circle's associated data.
          //
          // This is done to allow for accurate collision
          // detection with nodes of different sizes.
          //
          // Charge is negative because we want nodes to repel.
          // @v4 Before the charge was a stand-alone attribute
          //  of the force layout. Now we can use it as a separate force!
          function charge(d) {
            return -Math.pow(d.radius, 2.0) * forceStrength;
          }

          // Here we create a force layout and
          // @v4 We create a force simulation now and add forces to it.
          var simulation = d3.forceSimulation()
            .velocityDecay(0.2)
            .force('x', d3.forceX().strength(forceStrength).x(center.x))
            .force('y', d3.forceY().strength(forceStrength).y(center.y))
            .force('charge', d3.forceManyBody().strength(charge))
            .on('tick', ticked);

          // @v4 Force starts up automatically,
          // which we don't want as there aren't any nodes yet.
          simulation.stop();

          // @v4 scales now have a flattened naming scheme
          // @TODO: Colos by type.
          var fillColor = d3.scaleOrdinal()
            .domain(['access denied', 'cron', 'page not found', 'php', 'system', 'user'])
            .range(['#ee9586', '#9caf84', '#e4b7b2', '#d84b2a', '#beccae', '#7aa25c']);

          /*
           * This data manipulation function takes the raw data from
           * the json file and converts it into an array of node objects.
           * Each node will store data and visualization values to visualize
           * a bubble.
           *
           * rawData is expected to be an array of data objects, read in from
           * one of d3's loading functions like d3.csv.
           *
           * This function returns the new node array, with a node in that
           * array for each element in the rawData input.
           */
          function createNodes(rawData) {
            // Use the max total_amount in the data as the max in the scale's
            // domain note we have to ensure the total is a number.
            var maxAmount = d3.max(rawData, function (d) { return +d.total; });

            // Sizes bubbles based on area.
            // @v4: new flattened scale names.
            var radiusScale = d3.scalePow()
              .exponent(0.5)
              .range([2, 85])
              .domain([0, maxAmount]);

            // Use map() to convert raw data into node data.
            // Checkout http://learnjsdata.com/ for more on
            // working with data.
            var myNodes = rawData.map(function (d) {
              return {
                radius: radiusScale(+d.total),
                value: +d.total,
                type: d.type,
                severity: d.severity,
                message: d.message,
                x: Math.random() * 900,
                y: Math.random() * 800
              };
            });

            // sort them to prevent occlusion of smaller nodes.
            myNodes.sort(function (a, b) { return b.value - a.value; });

            return myNodes;
          }

          /*
           * Main entry point to the bubble chart. This function is returned
           * by the parent closure. It prepares the rawData for visualization
           * and adds an svg element to the provided selector and starts the
           * visualization creation process.
           *
           * selector is expected to be a DOM element or CSS selector that
           * points to the parent element of the bubble chart. Inside this
           * element, the code will add the SVG continer for the visualization.
           *
           * rawData is expected to be an array of data objects as provided by
           * a d3 loading function like d3.csv.
           */
          var chart = function chart(selector, rawData) {
            // convert raw data into nodes data
            nodes = createNodes(rawData);

            // Create a SVG element inside the provided selector
            // with desired size.
            svg = d3.select(selector)
              .append('svg')
              .attr('width', width)
              .attr('height', height);

            // Bind nodes data to what will become DOM elements to
            // represent them.
            bubbles = svg.selectAll('.bubble')
              .data(nodes, function (d) { return d.id; });

            // Create new circle elements each with class `bubble`.
            // There will be one circle.bubble for each object in the nodes array.
            // Initially, their radius (r attribute) will be 0.
            // @v4 Selections are immutable, so lets capture the
            //  enter selection to apply our transtition to below.
            var bubblesE = bubbles.enter().append('circle')
              .classed('bubble', true)
              .attr('r', 0)
              .attr('fill', function (d) { return fillColor(d.type); })
              .attr('stroke', function (d) { return d3.rgb(fillColor(d.type)).darker(); })
              .attr('stroke-width', 1)
              .on('mouseover', showDetail)
              .on('mouseout', hideDetail);

            // @v4 Merge the original empty selection and the enter selection.
            bubbles = bubbles.merge(bubblesE);

            // Fancy transition to make bubbles appear, ending with the
            // correct radius.
            bubbles.transition()
              .duration(1000)
              .attr('r', function (d) { return d.radius; });

            // Set the simulation's nodes to our newly created nodes array.
            // @v4 Once we set the nodes, the simulation will start running automatically!
            simulation.nodes(nodes);

            // Set initial layout to single group.
            groupBubbles();
          };

          /*
           * Callback function that is called after every tick of the
           * force simulation.
           * Here we do the acutal repositioning of the SVG circles
           * based on the current x and y values of their bound node data.
           * These x and y values are modified by the force simulation.
           */
          function ticked() {
            bubbles
              .attr('cx', function (d) { return d.x; })
              .attr('cy', function (d) { return d.y; });
          }

          /*
           * Provides a x value for each node to be used with the split by type
           * x force.
           */
          function nodeTypePos(d) {
            return typeCenters[d.type].x;
          }

          function nodeSeverityX(d) {
            return severityCenters[d.severity].x;
          }

          function nodeSeverityY(d) {
            return severityCenters[d.severity].y;
          }

          /*
           * Sets visualization in "single group mode".
           * The year labels are hidden and the force layout
           * tick function is set to move all nodes to the
           * center of the visualization.
           */
          function groupBubbles() {
            hideTypeTitles();
            hideSeverityTitles();

            forceStrength = FORCE;

            // @v4 Reset the 'x' force to draw the bubbles to the center.
            simulation.force('x', d3.forceX().strength(forceStrength).x(center.x));
            simulation.force('y', d3.forceY().strength(forceStrength).y(height/2));

            // @v4 We can reset the alpha value and restart the simulation
            simulation.alpha(1).restart();
          }
          
          /*
           * Sets visualization in "split by type mode".
           * The year labels are shown and the force layout
           * tick function is set to move nodes to the
           * yearCenter of their data's year.
           */
          function splitBubblesType() {
            hideSeverityTitles();
            showTypeTitles();

            forceStrength = FORCE;

            // @v4 Reset the 'x' force to draw the bubbles to their type centers
            simulation.force('x', d3.forceX().strength(forceStrength).x(nodeTypePos));
            simulation.force('y', d3.forceY().strength(forceStrength).y(height/2));

            // @v4 We can reset the alpha value and restart the simulation
            simulation.alpha(1).restart();
          }

          function splitBubblesSeverity() {
            hideTypeTitles();
            showSeverityTitles();

            //forceStrength = 0.1;

            // @v4 Reset the 'x' force to draw the bubbles to their severity centers
            simulation.force('x', d3.forceX().strength(forceStrength).x(nodeSeverityX));
            simulation.force('y', d3.forceY().strength(forceStrength).y(nodeSeverityY));

            // @v4 We can reset the alpha value and restart the simulation
            simulation.alpha(1).restart();
          }

          /*
           * Hides Type title displays.
           */
          function hideTypeTitles() {
            svg.selectAll('.type').remove();
          }

          /*
           * Hides severity title displays.
           */
          function hideSeverityTitles() {
            svg.selectAll('.severity').remove();
          }

          /*
           * Shows Type title displays.
           */
          function showTypeTitles() {
            var typesData = d3.keys(typesTitleX);
            var types = svg.selectAll('.type')
              .data(typesData);

            types.enter().append('text')
              .attr('class', 'type')
              .attr('x', function (d) { return typesTitleX[d]; })
              .attr('y', 40)
              .attr('text-anchor', 'middle')
              .text(function (d) { return d; });
          }

          /*
           * Shows severity title displays.
           */
          function showSeverityTitles() {
            var severitiesData = d3.keys(severitiesTitlePosition);
            var severities = svg.selectAll('.severity')
              .data(severitiesData);

            severities.enter().append('text')
              .attr('class', 'severity')
              .attr('x', function (d) { return severitiesTitlePosition[d].x; })
              .attr('y', function (d) { return severitiesTitlePosition[d].y })
              .attr('text-anchor', 'middle')
              .text(function (d) { return d; });
          }

          /*
           * Function called on mouseover to display the
           * details of a bubble in the tooltip.
           */
          function showDetail(d) {
            // change outline to indicate hover state.
            d3.select(this).attr('stroke', 'black');

            var content = '<span class="name">Type: </span><span class="value">' +
                          d.type +
                          '</span><br/>' +
                          '<span class="name">Severity: </span><span class="value">' +
                          d.severity +
                          '</span><br/>' +
                          '<span class="name">Total: </span><span class="value">' +
                          d.value +
                          '</span><br/>' +
                          '<div class="msg-wrapper"><span class="name">Message: </span><span class="value">' +
                          d.message +
                          '</span></div>';

            tooltip.showTooltip(content, d3.event);
          }

          /*
           * Hides tooltip
           */
          function hideDetail(d) {
            // reset outline
            d3.select(this)
              .attr('stroke', d3.rgb(fillColor(d.group)).darker());

            tooltip.hideTooltip();
          }

          /*
           * Externally accessible function (this is attached to the
           * returned chart function). Allows the visualization to toggle
           * between "single group" and "split by type" modes.
           *
           * displayName is expected to be a string and either 'type' or 'all'.
           */
          chart.toggleDisplay = function (displayName) {
            switch(displayName) {
              case 'type':
                splitBubblesType();
                break;

              case 'severity':
                splitBubblesSeverity();
                break;

              default:
                groupBubbles();
            }
          };

          // return the chart function from closure.
          return chart;
        }

        /*
         * Below is the initialization code as well as some helper functions
         * to create a new bubble chart instance, load the data, and display it.
         */
        var myBubbleChart = bubbleChart();

        /*
         * Function called once data is loaded from json.
         * Calls bubble chart function to display inside #chart div.
         */
        function display(error, data) {
          if (error) {
            console.log(error);
          }

          myBubbleChart('#chart', data);
        }

        /*
         * Sets up the layout buttons to allow for toggling between view modes.
         */
        function setupButtons() {
          d3.select('#toolbar')
            .selectAll('.button')
            .on('click', function () {
              // Remove active class from all buttons
              d3.selectAll('.button').classed('active', false);
              // Find the button just clicked
              var button = d3.select(this);

              // Set it as the active button
              button.classed('active', true);

              // Get the id of the button
              var buttonId = button.attr('id');

              // Toggle the bubble chart based on
              // the currently clicked button.
              myBubbleChart.toggleDisplay(buttonId);
            });
        }

        // Load the data.
        d3.json('/api/ddblog', display);

        // setup the buttons.
        setupButtons();
      });
  }};

})(jQuery, Drupal);
