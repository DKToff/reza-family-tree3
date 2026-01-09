(async function () {
  const wrap = document.getElementById("treeWrap");
  const tooltip = document.getElementById("tooltip");

  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const resetBtn = document.getElementById("resetBtn");

  const width = wrap.clientWidth;
  const height = wrap.clientHeight;

  // SVG + zoom layer
  const svg = d3.select("#treeWrap")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g");

  const zoom = d3.zoom()
    .scaleExtent([0.2, 3])
    .on("zoom", (event) => g.attr("transform", event.transform));

  svg.call(zoom);

  // Load data
  const data = await fetch("data/family.json").then(r => r.json());

  // Build hierarchy
  const root = d3.hierarchy(data);
  // Layout: left-to-right tree
  const treeLayout = d3.tree().nodeSize([60, 260]); 
  treeLayout(root);


// Map names to nodes (case-insensitive) — allow duplicates
const byName = new Map();
root.descendants().forEach(d => {
  const key = (d.data.name || "").trim().toLowerCase();
  if (!key) return;

  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(d);
});


   // Links 
const link = g.append("g")
  .attr("transform", "translate(160,40)")
  .selectAll("path")
  .data(root.links())
  .join("path")
  .attr("class", "link")
  .attr("d", d3.linkHorizontal()
    .x(d => d.y)
    .y(d => d.x)
  );

   // Link comments (annotations shown between nodes)
  const linkLabels = g.append("g")
    .attr("transform", "translate(160,40)")
    .attr("class", "link-labels")
    .selectAll("text")
    .data(root.links().filter(l => (l.target.data.comment || "").trim().length > 0))
    .join("text")
    .attr("class", "link-label")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .text(l => l.target.data.comment);

  // Position labels at midpoint, slightly ABOVE the line
  linkLabels
    .attr("x", l => (l.source.y + l.target.y) / 2)
    .attr("y", l => (l.source.x + l.target.x) / 2 - 28); // <- flyt op



  // Nodes
  const node = g.append("g")
    .attr("transform", "translate(160,40)")
    .selectAll("g")
    .data(root.descendants())
    .join("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${d.y},${d.x})`);

  node.append("circle")
    .attr("r", 7);

  const label = node.append("text")
  .attr("dx", 12)
  .attr("dy", "-0.35em")
  .text(d => d.data.name || "(no name)");

// Create an outline copy BEHIND the real text
const outline = label.clone(false)   // ✅ clone without duplicating listeners/extra stuff
  .lower()
  .attr("class", "label-outline")
  .attr("fill", "none")
  .attr("stroke", "#2b0a0a")         // background color
  .attr("stroke-width", 7)
  .attr("stroke-linejoin", "round");

// Make sure the real label is filled and on top
label
  .attr("fill", "rgba(255,255,255,0.92)");


    g.select(".link-labels").raise();

// --- Simple label collision avoidance (push labels up/down) ---
(function avoidLabelOverlap() {
  const labels = node.select("text").nodes();

  // sort by x position
  labels.sort((a, b) => a.getCTM().f - b.getCTM().f);

  const minGap = 16; // minimum vertical gap in px

  for (let i = 1; i < labels.length; i++) {
    const prev = labels[i - 1].getBBox();
    const cur = labels[i].getBBox();

    // Compare in their local coordinates by using their parent node translate
    const prevY = labels[i - 1].parentNode.__data__.x;
    const curY = labels[i].parentNode.__data__.x;

    // if too close vertically AND x is roughly similar (same "row")
    if (Math.abs(curY - prevY) < minGap) {
      // push current label down a little
      const dy = minGap - Math.abs(curY - prevY);

      // Add extra dy (in em) by converting px-ish to em-ish
      const existing = labels[i].getAttribute("dy") || "-0.35em";
      labels[i].setAttribute("dy", "-0.35em"); // keep base
      labels[i].setAttribute("transform", `translate(0, ${dy})`);
    }
  }
})();

  // Hover tooltip
  node
    .on("mousemove", (event, d) => {
      const lines = [
        `<strong>${escapeHtml(d.data.name || "")}</strong>`,
        d.data.born || d.data.died
          ? `<div class="muted">Born: ${escapeHtml(d.data.born || "—")} • Died: ${escapeHtml(d.data.died || "—")}</div>`
          : `<div class="muted">Hover to explore • Use search to show lineage</div>`
      ].join("");

      tooltip.innerHTML = lines;
      tooltip.style.left = `${event.offsetX + 14}px`;
      tooltip.style.top = `${event.offsetY + 14}px`;
      tooltip.style.opacity = "1";
      tooltip.style.transform = "translateY(0)";
    })
    .on("mouseleave", () => {
      tooltip.style.opacity = "0";
      tooltip.style.transform = "translateY(6px)";
    });

  // Helpers
  function clearHighlights() {
    node.classed("highlight", false).classed("target", false);
    link.classed("highlight", false);
  }

  function ancestorsSet(d) {
    const set = new Set();
    let cur = d;
    while (cur) {
      set.add(cur);
      cur = cur.parent;
    }
    return set;
  }

  function highlightPathTo(target) {
    clearHighlights();

    const aSet = ancestorsSet(target);

    // highlight nodes
    node
      .classed("highlight", d => aSet.has(d))
      .classed("target", d => d === target);

    // highlight links if BOTH ends are in ancestor path
    link.classed("highlight", l => aSet.has(l.source) && aSet.has(l.target));

    // zoom-to target
    const tx = target.y + 160;
    const ty = target.x + 40;

    const desiredScale = 1.2;
    const transform = d3.zoomIdentity
      .translate(width / 2 - tx * desiredScale, height / 2 - ty * desiredScale)
      .scale(desiredScale);

    svg.transition().duration(650).call(zoom.transform, transform);
  }

  function doSearch() {
  const q = (searchInput.value || "").trim().toLowerCase();
  if (!q) return;

  const matches = byName.get(q);

  if (!matches || matches.length === 0) {
    clearHighlights();
    alert("No exact match found. Try the full name exactly as in the data.");
    return;
  }

  // If only one match, highlight it
  if (matches.length === 1) {
    highlightPathTo(matches[0]);
    return;
  }

  // Multiple matches: ask user which one (by showing their lineage)
  const choices = matches.map((n, i) => {
    const lineage = [];
    let cur = n;
    while (cur) {
      lineage.push(cur.data.name);
      cur = cur.parent;
    }
    lineage.reverse();
    return `${i + 1}) ${lineage.join(" → ")}`;
  });

  const pick = prompt(
    `Found ${matches.length} people with that name.\n\nPick a number:\n\n${choices.join("\n")}`
  );

  const idx = parseInt(pick, 10) - 1;
  if (!Number.isFinite(idx) || idx < 0 || idx >= matches.length) return;

  highlightPathTo(matches[idx]);
}


  function reset() {
    clearHighlights();
    svg.transition().duration(450).call(zoom.transform, d3.zoomIdentity);
    searchInput.value = "";
  }

  searchBtn.addEventListener("click", doSearch);
  resetBtn.addEventListener("click", reset);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  // Start centered a bit
  svg.call(zoom.transform, d3.zoomIdentity.translate(30, 10).scale(0.9));

  // Basic HTML escaping for tooltip
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
