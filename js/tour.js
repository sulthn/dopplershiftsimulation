const spot = document.getElementById("spotlight");
const blur_element = document.getElementById("blur");

function getAbsolutePosition(element) {
    const rect = element.getBoundingClientRect();
    return {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY
    };
}

function onboarding() {
    if (!localStorage.getItem("visited")) {
        blur_element.style.display = 'flex';

        blur_element.innerHTML = '<button id="blur_button" onclick="step_one()">start the tour</button>';
    }
}

function step_one() {
    document.getElementById('blur_button').remove();

    // Viewport
    const viewport = document.getElementById("canvas");

    const position = getAbsolutePosition(viewport);

    document.getElementById("spotlight_description").innerHTML = "This is your camera! Where the magic happens.";
    document.getElementById("spotlight_button").innerHTML = "next";

    document.getElementById("spotlight_button").addEventListener("click", step_two);

    spot.style.display = 'block';

    spot.style.width = viewport.clientWidth + 'px';
    spot.style.height = viewport.clientHeight + 'px';

    spot.style.top = position.top + 'px';
    spot.style.left = position.left + 'px';

    updateHole();
}

function step_two() {
    // graph
    const graph = document.getElementById("graph-container");

    const position = getAbsolutePosition(graph);

    const spotlight_description = document.getElementById("spotlight_description");
    const spotlight_button = document.getElementById("spotlight_button");

    spotlight_description.style.bottom = '';
    spotlight_description.style.top = '-' + (spotlight_button.clientHeight * 2 + 2) + 'px';

    spotlight_button.style.bottom = '';
    spotlight_button.style.top = '-32px';
    

    spotlight_description.innerHTML = "This is the graph where the frequency is shown!";
    spotlight_button.innerHTML = "next";

    document.getElementById("spotlight_button").addEventListener("click", step_three);

    spot.style.display = 'block';

    spot.style.width = graph.clientWidth + 'px';
    spot.style.height = graph.clientHeight + 'px';

    spot.style.top = position.top + 'px';
    spot.style.left = position.left + 'px';

    updateHole();
}

function step_three() {
    // explanation
    const ex_element = document.getElementById("ex");

    const position = getAbsolutePosition(ex_element);

    const spotlight_description = document.getElementById("spotlight_description");
    const spotlight_button = document.getElementById("spotlight_button");

    spotlight_description.innerHTML = "This part explains the physics phenomenon!";
    spotlight_button.innerHTML = "next";

    spotlight_description.style.top = '0';
    spotlight_description.style.left = '-' + (spotlight_description.clientWidth + 2) + 'px';

    spotlight_button.style.top = '25px';
    spotlight_button.style.left = '-' + (spotlight_button.clientWidth + 2) + 'px';

    document.getElementById("spotlight_button").addEventListener("click", step_four);

    spot.style.display = 'block';

    spot.style.width = ex_element.clientWidth + 'px';
    spot.style.height = ex_element.clientHeight + 'px';

    spot.style.top = position.top + 'px';
    spot.style.left = position.left + 'px';

    updateHole();
}

function step_four() {
    window.toggleAudio();
    // explanation
    const cgc_element = document.getElementById("cgc");

    const position = getAbsolutePosition(cgc_element);

    spot.style.width = (cgc_element.clientWidth - 40) + 'px';
    spot.style.height = (cgc_element.clientHeight - 40) + 'px';

    spot.style.top = (position.top + 20) + 'px';
    spot.style.left = (position.left + 20) + 'px';

    const spotlight_description = document.getElementById("spotlight_description");
    const spotlight_button = document.getElementById("spotlight_button");

    spotlight_description.innerHTML = "Put one palm on your speaker <br> and try showing your other palm on the viewport!";
    spotlight_button.innerHTML = "done";

    spotlight_description.style.top = ((cgc_element.clientHeight - 40) / 2 - 48 / 2) + 'px';
    spotlight_description.style.left = (cgc_element.clientWidth - 40 + 2) + 'px';

    spotlight_button.style.top = ((cgc_element.clientHeight - 40) / 2 + 48 / 2) + 'px';
    spotlight_button.style.left = (cgc_element.clientWidth - 40 + 2) + 'px';

    document.getElementById("spotlight_button").addEventListener("click", step_done);

    updateHole();
}

function step_done() {
    spot.style.display = 'none';
    blur_element.style.display = 'none';

    localStorage.setItem("visited", true);
}


let dragging = false
let offsetX = 0
let offsetY = 0

function updateHole() {
    const rect = spot.getBoundingClientRect();

    const x1 = rect.left;
    const y1 = rect.top;
    const x2 = rect.right;
    const y2 = rect.bottom;

    blur_element.style.clipPath = `
    polygon(
      0% 0%,100% 0%,100% 100%,0% 100%,
      0% ${y1}px,
      ${x1}px ${y1}px,
      ${x1}px ${y2}px,
      ${x2}px ${y2}px,
      ${x2}px ${y1}px,
      0% ${y1}px
    )
  `;
}

//updateHole()