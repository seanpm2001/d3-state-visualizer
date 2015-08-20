import { isArray, isPlainObject } from 'lodash/lang';
import mapValues from 'lodash/object/mapValues';
import map2tree from 'map2tree';
import { toggleChildren, visit, getBranchesDepth } from './utils'

export default function() {
  return function treeChart(d3, DOMNode, props) {
    const {
      id = 'd3svg',
      style = '',
      size = 1000,
      aspectRatio = 1.0,
      isSorted = false,
      widthBetweenBranchCoeff = 1,
      heightBetweenNodesCoeff = 1,
      transitionDuration = 750
      } = props;
    const margin = {
      top: size / 100,
      right: size / 50,
      bottom: size / 100,
      left: 40
    };
    const width = size - margin.left - margin.right;
    const height = size * aspectRatio - margin.top - margin.bottom;
    const fullWidth = size;
    const fullHeight = size * aspectRatio;

    const root = d3.select(DOMNode);
    const vis = root
      .append('svg')
      .attr({
        id,
        style,
        width: fullWidth,
        viewBox: `0 0 ${fullWidth} ${fullHeight}`,
        preserveAspectRatio: 'xMinYMin slice'
      })
      .append('g')
      .attr({
        transform: `translate(${margin.left}, ${margin.top})`
      });

    let tree = d3.layout.tree().size([width, height]);

    if (isSorted) {
      tree.sort((a, b) => b.name.toLowerCase() < a.name.toLowerCase() ? 1 : -1);
    }

    return function renderChart(nextState = props.state) {
      const data = map2tree(nextState, 'state');
      let nodeIndex = 0;
      let maxLabelLength = 0;

      visit(data,
          node => maxLabelLength = Math.max(node.name.length, maxLabelLength),
          node => node.children && node.children.length > 0 ? node.children : null
      );

      // path generator for links
      const diagonal = d3.svg.diagonal().projection(d => [d.y, d.x]);

      function update(source) {
        // set tree dimensions and spacing between branches and nodes
        const tallestBranchLength = Math.max(...getBranchesDepth(data));

        tree = tree.size([(tallestBranchLength + 120) * widthBetweenBranchCoeff, width]);

        let nodes = tree.nodes(data);
        let links = tree.links(nodes);

        nodes.forEach(node => node.y = node.depth * (maxLabelLength * tallestBranchLength * heightBetweenNodesCoeff));

        // process the node selection
        let node = vis.selectAll('g.node').data(nodes, d => d.id || (d.id = ++nodeIndex));

        let nodeEnter = node.enter().append('g')
          .attr({
            'class': 'node',
            transform: d => `translate(${source.y0},${source.x0})`
          })
          .on({
            click: d => {
              if (d3.event.defaultPrevented) return;
              d = toggleChildren(d);
              update(d);
            }
          });

        nodeEnter.append('circle')
          .attr({
            'class': 'nodeCircle',
            r: 0
          })
          .style({
            fill: d => d._children ? 'lightsteelblue' : '#fff'
          });

        nodeEnter.append('text')
          .attr({
            'class': 'nodeText',
            x: d => d.children || d._children ? -10 : 10,
            dy: '.35em',
            'text-anchor': d => d.children || d._children ? 'end' : 'start'
          })
          .text(d => d.name);

        // update the text to reflect whether node has children or not
        node.select('text')
          .attr({
            x: d => d.children || d._children ? -10 : 10,
            'text-anchor': d => d.children || d._children ? 'end' : 'start'
          })
          .text(d => d.name);

        // Change the circle fill depending on whether it has children and is collapsed
        node.select('circle.nodeCircle')
          .attr('r', 4.5)
          .style('fill', d => {
            return d._children ? 'lightsteelblue' : (d.children ? '#fff' : '#ccc');
          });

        // Transition nodes to their new position.
        let nodeUpdate = node.transition()
          .duration(transitionDuration)
          .attr('transform', d => {
            return 'translate(' + d.y + ',' + d.x + ')';
          });

        // Fade the text in
        nodeUpdate.select('text')
          .style('fill-opacity', 1);

        // Transition exiting nodes to the parent's new position.
        let nodeExit = node.exit().transition()
          .duration(transitionDuration)
          .attr('transform', d => {
            return 'translate(' + source.y + ',' + source.x + ')';
          })
          .remove();

        nodeExit.select('circle')
          .attr('r', 0);

        nodeExit.select('text')
          .style('fill-opacity', 0);

        // Update the links…
        let link = vis.selectAll('path.link')
          .data(links, d => {
            return d.target.id;
          });

        // Enter any new links at the parent's previous position.
        link.enter().insert('path', 'g')
          .attr('class', 'link')
          .attr('d', d => {
            let o = {
              x: source.x0,
              y: source.y0
            };
            return diagonal({
              source: o,
              target: o
            });
          });

        // Transition links to their new position.
        link.transition()
          .duration(transitionDuration)
          .attr('d', diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
          .duration(transitionDuration)
          .attr('d', d => {
            let o = {
              x: source.x,
              y: source.y
            };
            return diagonal({
              source: o,
              target: o
            });
          })
          .remove();

        // Stash the old positions for transition.
        nodes.forEach(d => {
          d.x0 = d.x;
          d.y0 = d.y;
        });
      }

      data.x0 = height / 2;
      data.y0 = 0;
      update(data)
    };
  };
}
