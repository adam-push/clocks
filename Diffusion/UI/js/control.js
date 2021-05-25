/*
 * Globals
 */

const mmss = new Intl.DateTimeFormat('en-US', { minute: '2-digit', second: '2-digit' }).format;

let _session = null;

let _clocks = {};
let _timers = {};
let _elapsed = {};

async function connectToDiffusion() {
    let p = new Promise((resolve, reject) => {
        diffusion.connect({
            principal: "control",
            credentials: "password",
            secure: false
        }).then(
            (session) => {
                resolve(session);
            },
            (err) => {
                console.log("err", err);
                resolve(null);
            });
    });

    return p;
}

function loadClocks() {
    _session.addStream("?clocks//", diffusion.datatypes.json())
        .on("value", onUpdateClock);
    _session.select("?clocks//");
}

function onUpdateClock(topic, spec, newValue, oldValue) {
    let json = newValue.get();
    _clocks[topic] = json;

    if((json.active_period === null || json.active_period === undefined)
       && ! json.actual_stop_time) {

        json.active_period = 0;
    }
        
    // Is the clock running?
    // Synchronise elapsed times with that received in the message
    if(json.running) {
        let now = new Date().getTime();
        let elapsed = now - (json.last_update_time || 0);
        elapsed += (json.period[json.active_period].elapsed_time || 0);

        _elapsed[topic] = elapsed;

        startTimer(topic);
    }
    else {
        if(json.active_period !== null) {
            _elapsed[topic] = json.period[json.active_period].elapsed_time || 0;
        }
        else {
            _elapsed[topic] = 0;
        }

        stopTimer(topic);
    }
    
    displayClock(topic);
}

function displayClock(id) {
    let elem = document.getElementById("event-clock-" + id);
    if(! elem) {
        elem = uiAddClock(id);
        document.getElementById("clocks").appendChild(elem);
    }

    let json = _clocks[id];
    for(let idx in json.period) {
        let period = json.period[idx];
        let periodElem = elem.querySelector(".period-" + idx);
        periodElem.querySelector(".name").innerText = period.name;

        let st_text = "Not started";
        if(period.start_time) {
            let st = new Date(period.start_time);
            st_text = st.toLocaleDateString() + " " + st.toLocaleTimeString();
        }
        periodElem.querySelector(".start_time").innerText = st_text;

        periodElem.querySelector(".duration").innerText = mmss(period.duration * 1000);

        if(idx == json.active_period) {
            periodElem.querySelector(".elapsed_time").innerText = mmss(_elapsed[id]);

            let btn = periodElem.querySelector(".start_stop button");
            if(json.running) {
                btn.innerText = "Stop";
            }
            else {
                btn.innerText = "Start";
            }
        }
    }

    uiDisableOtherPeriods(id);
}

function uiAddClock(id) {
    let json = _clocks[id];

    let elem = document.getElementById("event-clock").content.cloneNode(true).children[0];
    elem.id = "event-clock-" + id;

    elem.querySelector(".event-clock-name").innerText = id;

    for(let idx in json.period) {
        let period = json.period[idx];
        let periodElem = document.getElementById("period-controls").content.cloneNode(true).children[0];
        periodElem.classList.add("period-" + idx);
        elem.querySelector(".controls-container").appendChild(periodElem);

        if(period.auto_stop) {
            periodElem.querySelector(".auto_stop input")
                .setAttribute("checked", true);
        }
        
        periodElem.querySelector(".start_stop button")
            .addEventListener("click", (evt) => { uiStartStopClock(id); });

        periodElem.querySelector(".override button")
            .addEventListener("click", (evt) => { uiSetTime(id); });

        periodElem.querySelector(".next_period button")
            .addEventListener("click", (evt) => { uiNextPeriod(id); });

        if(idx == (json.period.length - 1)) {
            periodElem.querySelector(".next_period button")
                .innerText = "End Event";
        }
    }

    return elem;
}

function uiStartStopClock(id) {
    let json = _clocks[id];

    if(json.running) {
        stopClock(id);
    }
    else {
        startClock(id);
    }
}

function uiSetTime(id) {
    let elem = document.getElementById("event-clock-" + id);

    let json = _clocks[id];
    let row = elem.querySelector(".period-" + json.active_period);

    let mm = Number(row.querySelector("input.minutes").value);
    let ss = Number(row.querySelector("input.seconds").value);

    _elapsed[id] = (mm * 60 + ss) * 1000;
    
    updateTopic(id);
}

function uiNextPeriod(id) {
    let json = _clocks[id];

    if(json.active_period === null) {
        json.active_period = 0;
    }

    stopClock(id);

    json.active_period++;
    if(json.active_period >= json.period.length) {
        json.active_period = null;
        json.actual_stop_time = new Date().getTime();
    }

    _elapsed[id] = 0;
    
    updateTopic(id);
}

function uiDisableOtherPeriods(id) {
    let elem = document.getElementById("event-clock-" + id);
    let rows = elem.querySelectorAll(".period");
    
    let json = _clocks[id];
    for(let i = 0; i < json.period.length; i++) {
        rows[i].classList.remove("disabled");
        if(i !== json.active_period) {
            rows[i].classList.add("disabled");
        }
    }
}

function startClock(id) {
    let now = new Date().getTime();
    let json = _clocks[id];

    if(json.active_period === null && ! json.actual_stop_time) {
        json.active_period = 0;
    }

    if(json.period[json.active_period].start_time === null) {
        json.period[json.active_period].start_time = now;
    }

    json.running = true;

    startTimer(id);

    updateTopic(id);
}

function stopClock(id) {
    let now = new Date().getTime();
    let json = _clocks[id];

    json.running = false;

    stopTimer(id);

    updateTopic(id);
}

function startTimer(id) {
    if(! (_timers[id] === null || _timers[id] === undefined)) {
        return;
    }

    if(! _elapsed[id]) {
        _elapsed[id] = 0;
    }
    
    _timers[id] = window.setInterval(() => {
        _elapsed[id] += 1000;

        // Check if auto_stop is set, and stop timer if so
        let json = _clocks[id];
        if(json.period[json.active_period].auto_stop
           && _elapsed[id] >= (json.period[json.active_period].duration * 1000)) {

            _elapsed[id] = json.period[json.active_period].duration * 1000;
            stopClock(id);
        }
      
        displayClock(id);
    }, 1000);
}

function stopTimer(id) {
    if(_timers[id] === null || _timers[id] === undefined) {
        return;
    }

    window.clearInterval(_timers[id]);
    _timers[id] = null;

    return _elapsed[id];
}

function updateTopic(id) {
    let json = _clocks[id];

    if(json.active_period !== null && json.active_period !== undefined) {
        json.period[json.active_period].elapsed_time = _elapsed[id] || 0;
    }

    json.last_update_time = new Date().getTime();
    
    _session.topicUpdate.set(id, diffusion.datatypes.json(), json);
}

async function run() {

    _session = await connectToDiffusion();
    if(! _session) {
        alert("Unable to connect to Diffusion");
        return;
    }

    console.log("Connected to Diffusion");
    
    loadClocks();
    
}
