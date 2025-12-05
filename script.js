// Wrap the entire script in an IIFE to create a local scope and prevent
// global variable conflicts, especially important in environments like this.
(function() {
    let K = 4; // Default K value
    
    // Configuration remains static for colors/dimensions
    const config = {
        width: 1400,
        height: 800,
        nodeRadius: 36,
        colors: {
            core: '#ef4444', 
            aggregation: '#f97316', 
            edge: '#22c55e', 
            host: '#3b82f6', 
            link: '#9ca3af', 
            highlight: '#34d399', 
            path: '#fde047',
            nodelink: '#d334bb', 
            highlightSwitch: '#d334b0',
            highlightConnectedNode: '#000000'
        }
    };

    const svg = document.getElementById('fat-tree-svg');
    const kInput = document.getElementById('k-value');
    const generateButton = document.getElementById('generate-button');
    
    let nodes = [];
    let links = [];
    let hostNodes = []; 
    let selectedHosts = []; 
    let isTopologyGenerated = false;
    let isSwitchSelected = false;
    let isDrawingPath = false;


    if (!svg) return; // Exit if SVG container is not found
    svg.setAttribute('viewBox', `0 0 ${config.width} ${config.height}`);

    // --- Visualization Reset and Utility Functions ---

    function clearVisualization() {
        // Clear all SVG content, keeping the top-level structure
        const podBackgrounds = document.getElementById('pod-backgrounds');
        if (podBackgrounds) {
            // Remove all siblings (links and nodes)
            let sibling = podBackgrounds.nextSibling;
            while (sibling) {
                const nextSibling = sibling.nextSibling;
                svg.removeChild(sibling);
                sibling = nextSibling;
            }
            // Remove all pod children (rects and texts)
            while (podBackgrounds.firstChild) {
                podBackgrounds.removeChild(podBackgrounds.firstChild);
            }
        } else {
                while (svg.firstChild) {
                svg.removeChild(svg.firstChild);
            }
        }
        
        nodes = [];
        links = [];
        hostNodes = [];
        selectedHosts = [];
        isTopologyGenerated = false;
        updateInstructions(0);
    }

    function resetVisualization() {
        if (!isTopologyGenerated) return;

        // Reset all links to default color
        document.querySelectorAll('#fat-tree-svg line').forEach(line => {
            line.setAttribute('stroke', config.colors.link);
            line.setAttribute('stroke-width', 2);
            line.classList.remove('path-link');
        });
        
        // Reset all nodes to default size/color and remove highlight stroke
        nodes.forEach(node => {
            let color;
            switch (node.type) {
                case 'core': color = config.colors.core; break;
                case 'aggregation': color = config.colors.aggregation; break;
                case 'edge': color = config.colors.edge; break;
                case 'host': color = config.colors.host; break;
                default: color = '#000000';
            }
            const circle = document.querySelector(`[data-node-id='${node.id}']`);
            if(circle) {
                circle.setAttribute('fill', color);
                circle.setAttribute('r', config.nodeRadius / K);
                circle.setAttribute('stroke', 'none'); 
                circle.setAttribute('stroke-width', 0);
            }
        });
        selectedHosts = [];
        updateInstructions(4); // Instructions after generation
    }

    // Helper to get the other node connected by a link
    function getNeighbor(link, currentNode) {
        return link.source.id === currentNode.id ? link.target : link.source;
    }
    
    // Function to update the dynamic instruction text
    function updateInstructions(stage, paths = 0, startId = null, endId = null) {
        const instructionDiv = document.getElementById('instruction-message');
        if (!instructionDiv) return;

        switch (stage) {
            case 0:
                instructionDiv.innerHTML = '<span class="bold-text text-gray-700">Click the "Generate Topology" button to begin.</span>';
                break;
            case 1:
                const samePod = selectedHosts.length === 2 && selectedHosts[0].pod === selectedHosts[1].pod;
                let message;
                
                if (paths === 0) {
                    message = 'No paths found. This is unlikely, please try different nodes.';
                } else if (samePod) {
                        message = `Hosts H${startId} and H${endId} are in the same Pod. Traffic uses <span class="bold-text">**${paths} paths**</span> through the Aggregation layer (Intra-Pod ECMP). Click anywhere to reset.`;
                } else {
                    const expectedPaths = (K / 2) * (K / 2);
                    message = `The topology provides <span class="bold-text">**${paths} Equal Cost Paths (ECMP)**</span> through the Core between H${startId} and H${endId}. This matches the expected ${expectedPaths} paths for k=${K}. Click anywhere to reset.`;
                }

                instructionDiv.innerHTML = `<span class="bold-text text-green-600">${message}</span>`;
                break;
            case 2:
                instructionDiv.innerHTML = 'First Host selected. <span class="bold-text text-orange-600">Now click a second Host</span> to calculate the network paths.';
                break;
            case 3:
                instructionDiv.innerHTML = '<span class="bold-text text-red-600">Error: k must be an even number greater than or equal to 2 and smaller than or equal to 6.</span>';
                break;
            case 4:
                instructionDiv.innerHTML = `<span class="bold-text text-gray-700">Topology (k=${K}) Generated. Click any two Host (blue) nodes</span> to simulate data flow and see the available ECMP paths. Or click any switch to highlight its links`;
                break;
            case 5:
                instructionDiv.innerHTML = `<span class="bold-text text-gray-700">Switch links are highlighted </span>`;
                break;
        }
    }

    // --- Pod Drawing Function ---
    function drawPodBoxes(k) {
        const numPods = k; 
        const podWidth = config.width / numPods;
        const podBackgroundsGroup = document.getElementById('pod-backgrounds');
        if (!podBackgroundsGroup) return;

        for (let p = 0; p < numPods; p++) {
            const x = p * podWidth;
            const y = 200; // Start Y above the aggregation layer (Y=250)
            const width = podWidth;
            const height = 600; // Extend down to the hosts (Y=750) + padding

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x + 5); 
            rect.setAttribute('y', y);
            rect.setAttribute('width', width - 10);
            rect.setAttribute('height', height);
            rect.setAttribute('rx', 15); // Rounded corners
            rect.setAttribute('fill', 'none');
            rect.setAttribute('stroke', '#4f46e5'); // Indigo-600 color
            rect.setAttribute('stroke-width', 3);
            rect.setAttribute('stroke-dasharray', '5,5'); // Dashed line
            rect.setAttribute('opacity', 0.5);

            // Add text label for the Pod
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x + width / 2);
            text.setAttribute('y', y + 30);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '20px');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('fill', '#4f46e5');
            text.textContent = `POD ${p}`;

            podBackgroundsGroup.appendChild(rect);
            podBackgroundsGroup.appendChild(text);
        }
    }


    // --- Core Topology Generation ---

    function generateTopology(k) {
        if (k < 2 || k % 2 !== 0 || k > 6) {
            updateInstructions(3);
            return;
        }
        
        K = k; // Set the global K
        clearVisualization(); // Clears everything including old Pod boxes
        isSwitchSelected = false // reset selected switch
        
        // 1. Draw Pod Boxes BEFORE drawing the actual network elements
        drawPodBoxes(K); 
        
        let nodeId = 0;
        
        // k-ary Fat-Tree structure rules
        const numPods = K; 
        const numAggEdgeSwitchesPerPod = K / 2;
        const numCoreSwitches = (K / 2) * (K / 2); 
        const numHostsPerEdge = K / 2;
        
        const coreNodes = [];
        const coreY = 75; // Adjusted for higher canvas
        const coreSpacing = config.width / (numCoreSwitches + 1);

        // 2. Core Switches
        for (let i = 0; i < numCoreSwitches; i++) {
            const node = { id: nodeId++, type: 'core', x: (i + 1) * coreSpacing, y: coreY, edges: [] };
            coreNodes.push(node);
            nodes.push(node);
        }

        // Adjusted Y positions for Aggregation, Edge, and Host layers
        const podY = [250, 500, 750]; 
        const podWidth = config.width / numPods;
        
        for (let p = 0; p < numPods; p++) {
            const podXStart = p * podWidth;

            const aggNodes = [];
            const aggSpacing = podWidth / (numAggEdgeSwitchesPerPod + 1);

            // 3. Aggregation Switches
            for (let a = 0; a < numAggEdgeSwitchesPerPod; a++) {
                const node = { 
                    id: nodeId++, 
                    type: 'aggregation', 
                    pod: p, // Pod index
                    x: podXStart + (a + 1) * aggSpacing, 
                    y: podY[0],
                    edges: []
                };
                aggNodes.push(node);
                nodes.push(node);

                // 3a. Link Aggregation to Core
                const coreSwitchesToConnect = K / 2;
                for (let c = 0; c < coreSwitchesToConnect; c++) {
                    // Core switch indexing ensures proper bisection bandwidth
                    const coreIndex = ((a * (K / 2)) + c) % numCoreSwitches; 
                    if (coreNodes[coreIndex]) {
                        const link = { source: node, target: coreNodes[coreIndex] };
                        links.push(link);
                        node.edges.push(link);
                        coreNodes[coreIndex].edges.push(link);
                    }
                }
            }

            // 4. Edge Switches
            for (let e = 0; e < numAggEdgeSwitchesPerPod; e++) {
                const node = { 
                    id: nodeId++, 
                    type: 'edge', 
                    pod: p,
                    x: podXStart + (e + 1) * aggSpacing, 
                    y: podY[1],
                    edges: []
                };
                nodes.push(node);

                // 4a. Link Edge to Aggregation (Full Mesh within Pod)
                aggNodes.forEach(aggNode => {
                    const link = { source: node, target: aggNode };
                    links.push(link);
                    node.edges.push(link);
                    aggNode.edges.push(link);
                });

                // 5. Hosts (Servers)
                const hostSpacing = aggSpacing / (numHostsPerEdge + 1);
                const hostRowXStart = node.x - aggSpacing / 2; // Calculate start for the host group

                for (let h = 0; h < numHostsPerEdge; h++) {
                    const hostNode = { 
                        id: nodeId++, 
                        type: 'host', 
                        pod: p,
                        x: hostRowXStart + (h + 1) * hostSpacing, 
                        y: podY[2],
                        edges: []
                    };
                    hostNodes.push(hostNode);
                    nodes.push(hostNode);

                    // 5a. Link Host to Edge
                    const link = { source: hostNode, target: node };
                    links.push(link);
                    hostNode.edges.push(link);
                    node.edges.push(link);
                }
            }
        }
        
        // Draw the generated topology (links and nodes)
        drawTopology();
        isTopologyGenerated = true;
        updateInstructions(4); // Set initial instructions after generation
    }

    function drawTopology() {
        const podBackgroundsGroup = document.getElementById('pod-backgrounds');
        
        // Draw Links (needs to be after pod backgrounds and before nodes)
        links.forEach(link => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', link.source.x);
            line.setAttribute('y1', link.source.y);
            line.setAttribute('x2', link.target.x);
            line.setAttribute('y2', link.target.y);
            line.setAttribute('stroke', config.colors.link);
            line.setAttribute('stroke-width', 2);
            // Store link data for path finding later
            link.element = line;
            // Append links directly to SVG (after pod-backgrounds, but before nodes)
            if (podBackgroundsGroup) {
                svg.insertBefore(line, podBackgroundsGroup.nextSibling); 
            } else {
                svg.appendChild(line);
            }
        });

        // Draw Nodes
        nodes.forEach(node => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', node.x);
            circle.setAttribute('cy', node.y);
            circle.setAttribute('r', config.nodeRadius / K);
            circle.classList.add('node');
            circle.setAttribute('data-node-id', node.id); // Custom attribute for easy lookup
            
            let color;
            switch (node.type) {
                case 'core': color = config.colors.core; break;
                case 'aggregation': color = config.colors.aggregation; break;
                case 'edge': color = config.colors.edge; break;
                case 'host': color = config.colors.host; break;
                default: color = '#000000';
            }
            circle.setAttribute('fill', color);
            
            // Add a tooltip/title
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            const podInfo = node.pod !== undefined ? ` (Pod ${node.pod})` : ' (Core)';
            title.textContent = `${node.type.toUpperCase()} Node ${node.id}${podInfo}`;
            circle.appendChild(title);
            
            svg.appendChild(circle);

            // Add interaction for Host nodes
            if (node.type === 'host') {
                circle.style.cursor = 'pointer';
                // Add an explicit identifier to the node object for easy pathfinding reference
                node.name = `H${node.id}`; 
                circle.addEventListener('click', (event) => {
                    event.stopPropagation();
                    handleHostClick(node, circle);
                });
            } else { // if switch make it clickable and handle click on it
                circle.style.cursor = 'pointer';
                circle.addEventListener('click', (event) => {
                    event.stopPropagation();
                    handleSwitchClick(node, circle);
                });
            }
        });
    }

    // --- Pathfinding Logic (Simplified DFS for ECMP) ---
    
    // Finds all available link-only paths from startNode to endNode 
    function findAllPaths(startNode, endNode) { 
        let paths = [];
        const isSamePod = startNode.pod === endNode.pod; // Determine if in same pod
        const isSameEdge = startNode.edges[0].target.id === endNode.edges[0].target.id; // Directly connected to same edge switch
        // append first link to edge switch from both servers
        paths.push(startNode.edges[0]);
        paths.push(endNode.edges[0]);
        // If both hosts are connected to the same edge switch, return the direct path
        if (isSameEdge){ 
            return [paths,1];
        }
        // get edge switch of each host
        let startEdge = startNode.edges[0].target;
        let endEdge = endNode.edges[0].target;
        let aggregationSwitches = [];
        // append links to aggregation switches and also aggregation switches
        startEdge.edges.forEach(link => {
            let neighbor = getNeighbor(link, startEdge);
            if (neighbor.type === 'aggregation') {
                aggregationSwitches.push(neighbor);
                paths.push(link);
            }
        });
        endEdge.edges.forEach(link => {
            let neighbor = getNeighbor(link, endEdge);  
            if (neighbor.type === 'aggregation') {
                if (!aggregationSwitches.includes(neighbor)) {
                    aggregationSwitches.push(neighbor);
                }
                paths.push(link);
            }
        });
        // if same pod, connect through aggregation switches only
        if (isSamePod){ 
            return [paths,K/2];
        }
        // links from aggregation to core switches
        aggregationSwitches.forEach(aggSwitch => {
            aggSwitch.edges.forEach(link => {
                if (link.target.type === 'core') paths.push(link);
            });
        });   
        return [paths,K/2 * K/2];
    }

    async function highlightPaths(startNode, endNode) {
        let result = findAllPaths(startNode, endNode);
        isDrawingPath = true;
        const paths = result[0];
        let orderedPaths = new Array(paths.length);
        // Order paths to be highlighted in sequence: start to edge, edge to aggregation, aggregation to core, core to aggregation, aggregation to edge, edge to end
        // edge layers
        orderedPaths[0] = paths[0]; // start to edge
        orderedPaths[orderedPaths.length - 1] = paths[1]; // end to edge
        // aggregation layers
        if (paths.length > 2) {
            targetStart = orderedPaths.length - 1 - K/2; 
            for (let i = 0; i < K/2 ; i++) {
                orderedPaths[1 + i] = paths[2 + i]; // edge to aggregation of start
                orderedPaths[targetStart + i] = paths[2 + K/2 + i]; // edge to aggregation of end
            }
        }
        // core layers
        if (paths.length > 2 + K) {
            let coreStartIndex = 2 + K/2 * 2;// starting index of core links in paths array
            let sourceCoreindex = 1 + K/2; // starting index in orderedPaths to insert core links
            let targetCoreindex = orderedPaths.length - 1 - K/2 - (K/2)*(K/2); // target index in orderedPaths to insert core links
            for (let i = 0; i < (K/2)*(K/2) ; i++) {
                orderedPaths[sourceCoreindex + i] = paths[coreStartIndex + i]; // core to aggregation of start
                orderedPaths[targetCoreindex + i] = paths[coreStartIndex + (K/2)*(K/2)+ i]; // edge to aggregation of end
            }
        }
        /*if (uniqueLinks.size > 0) {
            uniqueLinks.forEach(link => {
                //link.element.setAttribute('stroke', config.colors.path);
                //link.element.setAttribute('stroke-width', 3);
                //link.element.classList.add('path-link');
                //link.element.parentNode.appendChild(link.element); // Bring to front
            });
        }*/
        for (const link of orderedPaths) {
        
            link.element.setAttribute('stroke', config.colors.path);
            link.element.setAttribute('stroke-width', 3);
            link.element.classList.add('path-link');
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay for animation effect
        }

        // Highlight start/end nodes
        const startCircle = document.querySelector(`[data-node-id='${startNode.id}']`);
        const endCircle = document.querySelector(`[data-node-id='${endNode.id}']`);

        const FINAL_R = (config.nodeRadius / K) * 1.2; 
        if (startCircle) {
            startCircle.setAttribute('r', FINAL_R);
        }
        if (endCircle) {
            endCircle.setAttribute('r', FINAL_R);
        }

        // Update instruction text with ECMP explanation
        updateInstructions(1, result[1], startNode.id, endNode.id);
        isDrawingPath = false;
    }

    function handleHostClick(node, circleElement) {
        if (!isTopologyGenerated) return;

        // Check if they clicked the currently selected first node, or if two nodes are already selected
        if (selectedHosts.length === 2 || selectedHosts[0]?.id === node.id) {
            resetVisualization();
            if (selectedHosts.length === 2) selectedHosts = [];
        }

        if (selectedHosts.length === 0) {
            // First selection
            resetVisualization();
            selectedHosts.push(node);
            circleElement.setAttribute('fill', config.colors.highlight);
            circleElement.setAttribute('stroke', config.colors.highlight); 
            circleElement.setAttribute('stroke-width', 3);
            circleElement.setAttribute('r', config.nodeRadius / K); 
            updateInstructions(2);
        } else if (selectedHosts.length === 1 && selectedHosts[0].id !== node.id) {
            // Second selection
            selectedHosts.push(node);
            circleElement.setAttribute('fill', config.colors.highlight);
            circleElement.setAttribute('stroke', config.colors.highlight);
            circleElement.setAttribute('stroke-width', 3);
            circleElement.setAttribute('r', config.nodeRadius / K);
            console.log(selectedHosts.length)
            highlightPaths(selectedHosts[0], selectedHosts[1]);
        }
    }

    function handleSwitchClick(node, circleElement) {
        if (!isTopologyGenerated) return;
        if (isDrawingPath) return; // prevent switch click during path drawing

        // clear previous highlights and selections
        resetVisualization();
        isSwitchSelected = true
        
        // highlight selected switch
        circleElement.setAttribute('fill', config.colors.highlightSwitch);
        circleElement.setAttribute('stroke', config.colors.highlightSwitch); 
        circleElement.setAttribute('stroke-width', 3);
        circleElement.setAttribute('r', config.nodeRadius / K); 
        updateInstructions(5);
        // highlight links
        node.edges.forEach(link => {
            link.element.setAttribute('stroke', config.colors.nodelink);
            link.element.setAttribute('stroke-width', 3);
            //link.element.classList.add('path-link');
            // highlight also connected node to switch
            const ConnectedNode = getNeighbor(link,node)
            const Nodecircle = document.querySelector(`[data-node-id='${ConnectedNode.id}']`); 
            Nodecircle.setAttribute('fill', config.colors.highlightConnectedNode);
            Nodecircle.setAttribute('stroke', config.colors.highlightConnectedNode); 
            Nodecircle.setAttribute('stroke-width', 3);
            Nodecircle.setAttribute('r', config.nodeRadius / K); 
        });

    }

    // --- Event Listeners ---

    generateButton.addEventListener('click', () => {
        const kValue = parseInt(kInput.value);
        generateTopology(kValue);
    });

    svg.addEventListener('click', (event) => {
        // Only reset if the click wasn't on a node (circle) and a topology is loaded
        if (isTopologyGenerated && (event.target.tagName === 'svg' || event.target.id === 'fat-tree-svg') && !isDrawingPath) {
            resetVisualization();
            isSwitchSelected = false
        }
    });

    // Initial instruction setup (run once on load)
    updateInstructions(0);
    
})(); // End of IIFE