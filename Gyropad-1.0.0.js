// ==UserScript==
// @name         Gyropad
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Simulate a gamepad with the device's gyroscope
// @author       Reklaw
// @match        *://*/*
// @icon         https://icons.iconarchive.com/icons/paomedia/small-n-flat/72/gamepad-icon.png
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    const realGamepads = navigator.getGamepads.bind(navigator);
    const maxAngle = 45;
    const movementThreshold = 0.03;
    let triggerEnable = false;
    let prevTriggerButtonPressed = false;
    let enabled = true;
    let horizontal = false;
    let vertical = false;
    let controllerEnable = false;
    let showConfigController = false;
    let deadzone = 0.1;// Zona muerta para filtrar pequeños ruidos
    let alpha = 0.1;// Factor de suavizado (entre 0 y 1; valores más bajos suavizan más)
    let opacity = 0.3;
    let smoothedX = 0;
    let smoothedY = 0;
    let isRight = true;
    let leftStickMoved = false;
    let rightStickMoved = false;
    let trigger = -1;
    let posX = 0;
    let posY = 0;
    let scale = 1;
    let elementSelected = null;
    let simulatedStick = { x1: 0.0, y1: 0.0, x2: 0.0, y2: 0.0};
    let simulatedGamepad = {
        id: "Xbox One Game Controller (STANDARD GAMEPAD)",
        index: 0,
        connected: true,
        mapping: "standard",
        buttons: Array(18).fill({ pressed: false, touched: false, value: 0 }),
        axes: [0,0,0,0,0,0],
        timestamp: 0.0
    };

    function setTrigger(triggerValue) {
        trigger = triggerValue;
        if(trigger < 0){
            enabled = true;
        }else{
            enabled = false;
        }
    }

    navigator.getGamepads = function() {
        let gamepads = realGamepads();
        if (gamepads[0] && !controllerEnable) {
            let gamepad = gamepads[0];
            simulatedGamepad.buttons = gamepad.buttons.map((btn) => ({
                pressed: btn.pressed,
                value: btn.value,
            }));
            simulatedGamepad.axes = [...gamepad.axes];
            if (isRight) {
                let rightStickX = gamepad.axes[2];
                let rightStickY = gamepad.axes[3];
                rightStickMoved = Math.abs(rightStickX) > movementThreshold || Math.abs(rightStickY) > movementThreshold;
                if (!rightStickMoved && (triggerEnable || trigger == -1)) {
                    simulatedGamepad.axes[2] = simulatedStick.x2;
                    simulatedGamepad.axes[3] = simulatedStick.y2;
                    simulatedGamepad.timestamp = performance.now();
                }
            } else {
                let leftStickX = gamepad.axes[0];
                let leftStickY = gamepad.axes[1];
                leftStickMoved = Math.abs(leftStickX) > movementThreshold || Math.abs(leftStickY) > movementThreshold;
                if (!leftStickMoved && (triggerEnable || trigger == -1)) {
                    simulatedGamepad.axes[0] = simulatedStick.x1;
                    simulatedGamepad.axes[1] = simulatedStick.y1;
                    simulatedGamepad.timestamp = performance.now();
                }
            }
        }else if(controllerEnable){
            simulatedGamepad.axes = [simulatedStick.x1, simulatedStick.y1, simulatedStick.x2, simulatedStick.y2]
            simulatedGamepad.timestamp = performance.now();
        }
        return [simulatedGamepad];
    };

    function gameLoop() {
        let gamepads = navigator.getGamepads();
        if (gamepads[0]) {
            let gamepad = gamepads[0];
            let triggerIndex = trigger;
            if (triggerIndex !== -1 && gamepad.buttons[triggerIndex]) {
                let currentPressed = gamepad.buttons[triggerIndex].pressed;
                if (prevTriggerButtonPressed && !currentPressed) {
                    triggerEnable = !triggerEnable;
                }
                prevTriggerButtonPressed = currentPressed;
            }
        }
        requestAnimationFrame(gameLoop);
    }

    function handleDeviceMotion(event) {
        if (enabled) {
            let smoth = 1.1 - alpha
            let rawX = event.rotationRate.alpha || 0;
            let rawY = event.rotationRate.beta || 0;
            if (Math.abs(rawX) < deadzone) rawX = 0;
            if (Math.abs(rawY) < deadzone) rawY = 0;
            smoothedX = smoth * rawX + (1 - smoth) * smoothedX;
            smoothedY = smoth * rawY + (1 - smoth) * smoothedY;
            let normX = Math.max(-1, Math.min(1, smoothedX / maxAngle));
            let normY = Math.max(-1, Math.min(1, smoothedY / maxAngle));
            if(horizontal) {
                normX = normX * -1;
            }
            if(vertical) {
                normY = normY * -1;
            }
            if(isRight){
                simulatedStick.x2 = normX;
                simulatedStick.y2 = normY;
            }else{
                simulatedStick.x1 = normX;
                simulatedStick.y1 = normY;
            }
        }
    }

    if (DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission().then((permissionState) => {
            if (permissionState === "granted") {
                window.addEventListener("devicemotion", handleDeviceMotion);
            } else {
                console.error("Permission denied to access the gyroscope");
            }
        }).catch(console.error);
    } else {
        window.addEventListener("devicemotion", handleDeviceMotion);
    }

    gameLoop();

    // ==================== UI INTERFACE ====================

    function createUI() {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const stickRadius = 45;

        // Create the UI container
        let uiContainer = document.createElement("div");
        uiContainer.id = "gamepad-ui";
        uiContainer.style.position = "fixed";
        uiContainer.style.top = "10px";
        uiContainer.style.right = "10px";
        uiContainer.style.width = "40%";
        uiContainer.style.padding = "10px";
        uiContainer.style.background = "rgba(0,0,0,0.8)";
        uiContainer.style.color = "white";
        uiContainer.style.borderRadius = "10px";
        uiContainer.style.fontFamily = "Arial, sans-serif";
        uiContainer.style.fontSize = "3vh";
        uiContainer.style.zIndex = "9999";
        uiContainer.style.textAlign = "center";
        uiContainer.style.boxShadow = "0px 0px 10px rgba(255,255,255,0.2)";
        uiContainer.style.display = "none";

        let uiElements = document.createElement("div");
        uiElements.id = "elements-ui";
        uiElements.style.position = "relative";
        uiElements.style.background = "rgba(0,0,0,0)";
        uiElements.style.color = "white";
        uiElements.style.fontFamily = "Arial, sans-serif";
        uiElements.style.fontSize = "3vh";
        uiElements.style.zIndex = "9999";
        uiElements.style.textAlign = "center";
        uiElements.style.maxHeight = "70vh";
        uiElements.style.overflowY = "auto";

        let closeButton = document.createElement("button");
        closeButton.textContent = "❌";
        closeButton.style.fontSize = "4vh";
        closeButton.style.textAlign = "left";
        closeButton.style.paddingLeft = "10px";
        closeButton.style.width = "100%";
        closeButton.style.background = "#00000000";
        closeButton.style.color = "white";
        closeButton.style.border = "none";
        closeButton.style.cursor = "pointer";
        closeButton.onclick = function () {
            uiContainer.style.display = "none";
            updateToggleButtonColor();
        };

        // sensitivity
        let sensitivityLabel = document.createElement("label");
        sensitivityLabel.textContent = "Smoth Factor: " + Math.round((alpha*10));
        sensitivityLabel.style.marginTop = "10px";
        let sensitivityInput = document.createElement("input");
        sensitivityInput.type = "range";
        sensitivityInput.min = "0.1";
        sensitivityInput.max = "1";
        sensitivityInput.step = "0.1";
        sensitivityInput.value = alpha;
        sensitivityInput.style.width = "100%";
        sensitivityInput.oninput = function () {
            alpha = parseFloat(this.value);
            sensitivityLabel.textContent = "Smoth Factor: " + Math.round(alpha*10);
        };

        // dead zone
        let deadzoneLabel = document.createElement("label");
        deadzoneLabel.textContent = "Dead Zone: " + deadzone * 10;
        let deadzoneInput = document.createElement("input");
        deadzoneInput.type = "range";
        deadzoneInput.min = "0.1";
        deadzoneInput.max = "1";
        deadzoneInput.step = "0.1";
        deadzoneInput.value = deadzone;
        deadzoneInput.style.width = "100%";
        deadzoneInput.oninput = function () {
            deadzone = parseFloat(this.value);
            deadzoneLabel.textContent = "Dead Zone: " + deadzone * 10;
        };

        // Right or Left Stick
        let stickButton = document.createElement("button");
        stickButton.textContent = "Use Right Stick 🕹️➡️";
        stickButton.style.marginTop = "10px";
        stickButton.style.width = "100%";
        stickButton.style.background = "#009CDA";
        stickButton.style.color = "white";
        stickButton.style.border = "none";
        stickButton.style.padding = "5px";
        stickButton.style.cursor = "pointer";
        stickButton.onclick = function () {
            isRight = !isRight;
            stickButton.textContent = isRight ? "Use Right Stick 🕹️➡️" : "Use Left Stick 🕹️⬅️";
        };

        // "horizontal" button
        let horizontalButton = document.createElement("button");
        horizontalButton.textContent = "Reverse Horizontal: OFF 🔃↕️🚫";
        horizontalButton.style.marginTop = "10px";
        horizontalButton.style.width = "100%";
        horizontalButton.style.background = horizontal ? "#00A86B" : "#FF4D4D";
        horizontalButton.style.color = "white";
        horizontalButton.style.border = "none";
        horizontalButton.style.padding = "5px";
        horizontalButton.style.cursor = "pointer";
        horizontalButton.onclick = function () {
            horizontal = !horizontal;
            horizontalButton.textContent = horizontal ? "Reverse Horizontal: ON 🔃↕️✅" : "Reverse Horizontal: OFF 🔃↕️🚫";
            horizontalButton.style.background = horizontal ? "#00A86B" : "#FF4D4D";
        };

        // "vertical" button
        let verticalButton = document.createElement("button");
        verticalButton.textContent = "Reverse Vertical: OFF 🔃↔️🚫";
        verticalButton.style.marginTop = "10px";
        verticalButton.style.marginBottom = "10px";
        verticalButton.style.width = "100%";
        verticalButton.style.background = vertical ? "#00A86B" : "#FF4D4D";
        verticalButton.style.color = "white";
        verticalButton.style.border = "none";
        verticalButton.style.padding = "5px";
        verticalButton.style.cursor = "pointer";
        verticalButton.onclick = function () {
            vertical = !vertical;
            verticalButton.textContent = vertical ? "Reverse Vertical: ON 🔃↔️✅" : "Reverse Vertical: OFF 🔃↔️🚫";
            verticalButton.style.background = vertical ? "#00A86B" : "#FF4D4D";
        };

        // ComboBox to assign the Trigger
        let buttonLabel = document.createElement("label");
        buttonLabel.textContent = "Trigger Button:";
        let triggerSelect = document.createElement("select");
        triggerSelect.style.width = "100%";
        triggerSelect.style.marginTop = "5px";
        triggerSelect.style.backgroundColor = "#444";
        triggerSelect.style.color = "white";
        let buttonNames = [
            "🚫-DISABLED-🚫", "A", "B", "X", "Y", "LB", "RB", "LT", "RT", "SELECT", "START", "LS", "RS",
            "DPAD UP", "DPAD DOWN", "DPAD LEFT", "DPAD RIGHT",
        ];

        buttonNames.forEach((btnName, index) => {
            let option = document.createElement("option");
            option.value = index;
            option.textContent = btnName;
            triggerSelect.appendChild(option);
        });

        triggerSelect.onchange = function () {
            trigger = parseInt(this.value);
            let index = trigger - 1;
            updateToggleButtonColor();
            setTrigger(index);
        };

        // Button to toggle "enabled"
        let toggleEnabledButton = document.createElement("button");
        toggleEnabledButton.textContent = enabled ? "Disable Gyroscope 🚫" : "Activate Gyroscope 🔄";
        toggleEnabledButton.style.marginTop = "10px";
        toggleEnabledButton.style.marginBottom = "10px";
        toggleEnabledButton.style.width = "100%";
        toggleEnabledButton.style.background = enabled ? "#FF4D4D" : "#00A86B";
        toggleEnabledButton.style.color = "white";
        toggleEnabledButton.style.border = "none";
        toggleEnabledButton.style.padding = "5px";
        toggleEnabledButton.onclick = function () {
            enabled = !enabled;
            toggleEnabledButton.textContent = enabled ? "Disable Gyroscope 🚫" : "Activate Gyroscope 🔄";
            toggleEnabledButton.style.background = enabled ? "#FF4D4D": "#00A86B";
            sensitivityLabel.style.display = enabled ? "block" : "none";
            sensitivityInput.style.display = enabled ? "block" : "none";
            deadzoneLabel.style.display = enabled ? "block" : "none";
            deadzoneInput.style.display = enabled ? "block" : "none";
            stickButton.style.display = enabled ? "block" : "none";
            horizontalButton.style.display = enabled ? "block" : "none";
            verticalButton.style.display = enabled ? "block" : "none";
            buttonLabel.style.display = enabled ? "block" : "none";
            triggerSelect.style.display = enabled ? "block" : "none";
            updateToggleButtonColor();
        };

        // Button to toggle "enabled"
        let enableController = document.createElement("button");
        enableController.textContent = controllerEnable ? "Disable Virtual Controller 🎮" : "Activate Virtual Controller 🎮";
        enableController.style.marginTop = "10px";
        enableController.style.width = "100%";
        enableController.style.background = controllerEnable ? "#00A86B" : "#FF4D4D";
        enableController.style.color = "white";
        enableController.style.border = "none";
        enableController.style.padding = "5px";
        enableController.style.cursor = "pointer";
        enableController.onclick = function () {
            if(screen.orientation.type.includes('landscape')){
                let gamepads = realGamepads();
                if (gamepads[0]) {
                    showToast("There Is A Real Gamepad Connected 🎮 So Virtual Gamepad is Not Available 🚫");
                }else{
                    controllerEnable = !controllerEnable;
                    if(controllerEnable){
                        showControls();
                    }else{
                        hideControls();
                    }
                    updateToggleButtonColor();
                }
            }else{
                showToast("Only In Landscape Orientation");
            }
        };

        // configController Button to toggle "enabled"
        let configController = document.createElement("button");
        configController.textContent = showConfigController ? "Close Controller Config ⚙️" : "Open Controller Config ⚙️";
        configController.style.marginTop = "10px";
        configController.style.width = "100%";
        configController.style.background = "#009CDA";
        configController.style.color = "white";
        configController.style.border = "none";
        configController.style.padding = "5px";
        configController.style.display = "none";
        configController.style.cursor = "pointer";
        configController.onclick = function () {
            showConfigController = !showConfigController;
            configController.textContent = showConfigController ? "Close Controller Config ⚙️" : "Open Controller Config ⚙️";
            uiControllerContainer.style.display = showConfigController ? "block" : "none";
        };

        let buttonA = document.createElement('button');
        buttonA.textContent = "A";
        buttonA.style.background = "#444";
        buttonA.style.opacity = opacity;
        buttonA.style.position = "fixed";
        buttonA.style.width = "10vh";
        buttonA.style.height = "10vh";
        buttonA.style.borderRadius = "50%";
        buttonA.style.border = "none";
        buttonA.style.color = "#0F0";
        buttonA.style.fontSize = "3vh";
        buttonA.style.fontFamily = "Arial, sans-serif";
        buttonA.style.userSelect = "none";
        buttonA.style.display = "none";
        buttonA.style.bottom= "25vh";
        buttonA.style.right= "20vh";
        buttonA.style.textAlign= "center";
        buttonA.style.zIndex = "9000";
        buttonA.addEventListener('touchstart', (e) => {
            e.preventDefault();
            buttonA.style.filter = "brightness(150%)";
            buttonA.style.transform = "scale(0.95)";
            buttonA.style.transition = "all 0.1s";
            simulatedGamepad.buttons[0] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 0){
                greenToggleButton();
            }
        });
        buttonA.addEventListener('touchend', (e) => {
            e.preventDefault();
            buttonA.style.filter = "brightness(100%)";
            buttonA.style.transform = "scale(1)";
            simulatedGamepad.buttons[0] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 0){
                redToggleButton();
            }
        });

        let buttonB = document.createElement('button');
        buttonB.textContent = "B";
        buttonB.style.background = "#444";
        buttonB.style.opacity = opacity;
        buttonB.style.position = "fixed";
        buttonB.style.width = "10vh";
        buttonB.style.height = "10vh";
        buttonB.style.borderRadius = "50%";
        buttonB.style.border = "none";
        buttonB.style.color = "#F00";
        buttonB.style.fontSize = "3vh";
        buttonB.style.fontFamily = "Arial, sans-serif";
        buttonB.style.userSelect = "none";
        buttonB.style.display = "none";
        buttonB.style.bottom= "35vh";
        buttonB.style.right= "10vh";
        buttonB.style.zIndex = "9000";
        buttonB.style.textAlign= "center";
        buttonB.addEventListener('touchstart', (e) => {
            e.preventDefault();
            buttonB.style.filter = "brightness(150%)";
            buttonB.style.transform = "scale(0.95)";
            buttonB.style.transition = "all 0.1s";
            simulatedGamepad.buttons[1] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 1){
                greenToggleButton();
            }
        });
        buttonB.addEventListener('touchend', (e) => {
            e.preventDefault();
            buttonB.style.filter = "brightness(100%)";
            buttonB.style.transform = "scale(1)";
            simulatedGamepad.buttons[1] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 1){
                redToggleButton();
            }
        });

        let buttonX = document.createElement('button');
        buttonX.textContent = "X";
        buttonX.style.background = "#444";
        buttonX.style.opacity = opacity;
        buttonX.style.position = "fixed";
        buttonX.style.width = "10vh";
        buttonX.style.height = "10vh";
        buttonX.style.borderRadius = "50%";
        buttonX.style.border = "none";
        buttonX.style.color = "#00F";
        buttonX.style.fontSize = "3vh";
        buttonX.style.fontFamily = "Arial, sans-serif";
        buttonX.style.userSelect = "none";
        buttonX.style.display = "none";
        buttonX.style.bottom= "35vh";
        buttonX.style.right= "30vh";
        buttonX.style.zIndex = "9000";
        buttonX.style.textAlign= "center";
        buttonX.addEventListener('touchstart', (e) => {
            e.preventDefault();
            buttonX.style.filter = "brightness(150%)";
            buttonX.style.transform = "scale(0.95)";
            buttonX.style.transition = "all 0.1s";
            simulatedGamepad.buttons[2] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 2){
                greenToggleButton();
            }
        });
        buttonX.addEventListener('touchend', (e) => {
            e.preventDefault();
            buttonX.style.filter = "brightness(100%)";
            buttonX.style.transform = "scale(1)";
            simulatedGamepad.buttons[2] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 2){
                redToggleButton();
            }
        });

        let buttonY = document.createElement('button');
        buttonY.textContent = "Y";
        buttonY.style.background = "#444";
        buttonY.style.opacity = opacity;
        buttonY.style.position = "fixed";
        buttonY.style.width = "10vh";
        buttonY.style.height = "10vh";
        buttonY.style.borderRadius = "50%";
        buttonY.style.border = "none";
        buttonY.style.color = "#FF0";
        buttonY.style.fontSize = "3vh";
        buttonY.style.fontFamily = "Arial, sans-serif";
        buttonY.style.userSelect = "none";
        buttonY.style.display = "none";
        buttonY.style.bottom= "45vh";
        buttonY.style.right= "20vh";
        buttonY.style.zIndex = "9000";
        buttonY.style.textAlign= "center";
        buttonY.addEventListener('touchstart', (e) => {
            e.preventDefault();
            buttonY.style.filter = "brightness(150%)";
            buttonY.style.transform = "scale(0.95)";
            buttonY.style.transition = "all 0.1s";
            simulatedGamepad.buttons[3] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 3){
                greenToggleButton();
            }
        });
        buttonY.addEventListener('touchend', (e) => {
            e.preventDefault();
            buttonY.style.filter = "brightness(100%)";
            buttonY.style.transform = "scale(1)";
            simulatedGamepad.buttons[3] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 3){
                redToggleButton();
            }
        });

        let down = document.createElement('button');
        down.textContent = "↓";
        down.style.background = "#444";
        down.style.opacity = opacity;
        down.style.position = "fixed";
        down.style.width = "10vh";
        down.style.height = "10vh";
        down.style.borderRadius = "10%";
        down.style.border = "none";
        down.style.color = "#FFF";
        down.style.fontSize = "3vh";
        down.style.fontFamily = "Arial, sans-serif";
        down.style.userSelect = "none";
        down.style.display = "none";
        down.style.bottom= "25vh";
        down.style.left= "20vh";
        down.style.zIndex = "9000";
        down.style.textAlign= "center";
        down.addEventListener('touchstart', (e) => {
            e.preventDefault();
            down.style.filter = "brightness(150%)";
            down.style.transform = "scale(0.95)";
            down.style.transition = "all 0.1s";
            simulatedGamepad.buttons[13] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 13){
                greenToggleButton();
            }
        });
        down.addEventListener('touchend', (e) => {
            e.preventDefault();
            down.style.filter = "brightness(100%)";
            down.style.transform = "scale(1)";
            simulatedGamepad.buttons[13] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 13){
                redToggleButton();
            }
        });

        let right = document.createElement('button');
        right.textContent = "→";
        right.style.background = "#444";
        right.style.opacity = opacity;
        right.style.position = "fixed";
        right.style.width = "10vh";
        right.style.height = "10vh";
        right.style.borderRadius = "10%";
        right.style.border = "none";
        right.style.color = "#FFF";
        right.style.fontSize = "3vh";
        right.style.fontFamily = "Arial, sans-serif";
        right.style.userSelect = "none";
        right.style.display = "none";
        right.style.bottom= "35vh";
        right.style.left= "30vh";
        right.style.zIndex = "9000";
        right.style.textAlign= "center";
        right.addEventListener('touchstart', (e) => {
            e.preventDefault();
            right.style.filter = "brightness(150%)";
            right.style.transform = "scale(0.95)";
            right.style.transition = "all 0.1s";
            simulatedGamepad.buttons[15] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 15){
                greenToggleButton();
            }
        });
        right.addEventListener('touchend', (e) => {
            e.preventDefault();
            right.style.filter = "brightness(100%)";
            right.style.transform = "scale(1)";
            simulatedGamepad.buttons[15] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 15){
                redToggleButton();
            }
        });

        let left = document.createElement('button');
        left.textContent = "←";
        left.style.background = "#444";
        left.style.opacity = opacity;
        left.style.position = "fixed";
        left.style.width = "10vh";
        left.style.height = "10vh";
        left.style.borderRadius = "10%";
        left.style.border = "none";
        left.style.color = "#FFF";
        left.style.fontSize = "3vh";
        left.style.fontFamily = "Arial, sans-serif";
        left.style.userSelect = "none";
        left.style.display = "none";
        left.style.bottom= "35vh";
        left.style.left= "10vh";
        left.style.zIndex = "9000";
        left.style.textAlign= "center";
        left.addEventListener('touchstart', (e) => {
            e.preventDefault();
            left.style.filter = "brightness(150%)";
            left.style.transform = "scale(0.95)";
            left.style.transition = "all 0.1s";
            simulatedGamepad.buttons[14] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 14){
                greenToggleButton();
            }
        });
        left.addEventListener('touchend', (e) => {
            e.preventDefault();
            left.style.filter = "brightness(100%)";
            left.style.transform = "scale(1)";
            simulatedGamepad.buttons[14] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 14){
                redToggleButton();
            }
        });

        let up = document.createElement('button');
        up.textContent = "↑";
        up.style.background = "#444";
        up.style.opacity = opacity;
        up.style.position = "fixed";
        up.style.width = "10vh";
        up.style.height = "10vh";
        up.style.borderRadius = "10%";
        up.style.border = "none";
        up.style.color = "#FFF";
        up.style.fontSize = "3vh";
        up.style.fontFamily = "Arial, sans-serif";
        up.style.userSelect = "none";
        up.style.display = "none";
        up.style.bottom= "45vh";
        up.style.left= "20vh";
        up.style.zIndex = "9000";
        up.style.textAlign= "center";
        up.addEventListener('touchstart', (e) => {
            e.preventDefault();
            up.style.filter = "brightness(150%)";
            up.style.transform = "scale(0.95)";
            up.style.transition = "all 0.1s";
            simulatedGamepad.buttons[12] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 12){
                greenToggleButton();
            }
        });
        up.addEventListener('touchend', (e) => {
            e.preventDefault();
            up.style.filter = "brightness(100%)";
            up.style.transform = "scale(1)";
            simulatedGamepad.buttons[12] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 12){
                redToggleButton();
            }
        });

        let lt = document.createElement('button');
        lt.textContent = "LT";
        lt.style.background = "#444";
        lt.style.opacity = opacity;
        lt.style.position = "fixed";
        lt.style.width = "15vw";
        lt.style.height = "10vh";
        lt.style.borderRadius = "10%";
        lt.style.border = "none";
        lt.style.color = "#FFF";
        lt.style.fontSize = "3vh";
        lt.style.fontFamily = "Arial, sans-serif";
        lt.style.userSelect = "none";
        lt.style.display = "none";
        lt.style.top= "1vh";
        lt.style.left= "3vw";
        lt.style.zIndex = "9000";
        lt.style.textAlign= "center";
        lt.addEventListener('touchstart', (e) => {
            e.preventDefault();
            lt.style.filter = "brightness(150%)";
            lt.style.transform = "scale(0.95)";
            lt.style.transition = "all 0.1s";
            simulatedGamepad.buttons[6] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 6){
                greenToggleButton();
            }
        });
        lt.addEventListener('touchend', (e) => {
            e.preventDefault();
            lt.style.filter = "brightness(100%)";
            lt.style.transform = "scale(1)";
            simulatedGamepad.buttons[6] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 6){
                redToggleButton();
            }
        });

        let rt = document.createElement('button');
        rt.textContent = "RT";
        rt.style.background = "#444";
        rt.style.opacity = opacity;
        rt.style.position = "fixed";
        rt.style.width = "15vw";
        rt.style.height = "10vh";
        rt.style.borderRadius = "10%";
        rt.style.border = "none";
        rt.style.color = "#FFF";
        rt.style.fontSize = "3vh";
        rt.style.fontFamily = "Arial, sans-serif";
        rt.style.userSelect = "none";
        rt.style.display = "none";
        rt.style.top= "1vh";
        rt.style.right= "3vw";
        rt.style.zIndex = "9000";
        rt.style.textAlign= "center";
        rt.addEventListener('touchstart', (e) => {
            e.preventDefault();
            rt.style.filter = "brightness(150%)";
            rt.style.transform = "scale(0.95)";
            rt.style.transition = "all 0.1s";
            simulatedGamepad.buttons[7] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 7){
                greenToggleButton();
            }
        });
        rt.addEventListener('touchend', (e) => {
            e.preventDefault();
            rt.style.filter = "brightness(100%)";
            rt.style.transform = "scale(1)";
            simulatedGamepad.buttons[7] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 7){
                redToggleButton();
            }
        });

        let lb = document.createElement('button');
        lb.textContent = "LB";
        lb.style.background = "#444";
        lb.style.opacity = opacity;
        lb.style.position = "fixed";
        lb.style.width = "15vw";
        lb.style.height = "10vh";
        lb.style.borderRadius = "10%";
        lb.style.border = "none";
        lb.style.color = "#FFF";
        lb.style.fontSize = "3vh";
        lb.style.fontFamily = "Arial, sans-serif";
        lb.style.userSelect = "none";
        lb.style.display = "none";
        lb.style.top= "15vh";
        lb.style.left= "3vw";
        lb.style.zIndex = "9000";
        lb.style.textAlign= "center";
        lb.addEventListener('touchstart', (e) => {
            e.preventDefault();
            lb.style.filter = "brightness(150%)";
            lb.style.transform = "scale(0.95)";
            lb.style.transition = "all 0.1s";
            simulatedGamepad.buttons[4] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 4){
                greenToggleButton();
            }
        });
        lb.addEventListener('touchend', (e) => {
            e.preventDefault();
            lb.style.filter = "brightness(100%)";
            lb.style.transform = "scale(1)";
            simulatedGamepad.buttons[4] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 4){
                redToggleButton();
            }
        });

        let rb = document.createElement('button');
        rb.textContent = "RB";
        rb.style.background = "#444";
        rb.style.opacity = opacity;
        rb.style.position = "fixed";
        rb.style.width = "15vw";
        rb.style.height = "10vh";
        rb.style.borderRadius = "10%";
        rb.style.border = "none";
        rb.style.color = "#FFF";
        rb.style.fontSize = "3vh";
        rb.style.fontFamily = "Arial, sans-serif";
        rb.style.userSelect = "none";
        rb.style.display = "none";
        rb.style.top= "15vh";
        rb.style.right= "3vw";
        rb.style.zIndex = "9000";
        rb.style.textAlign= "center";
        rb.addEventListener('touchstart', (e) => {
            e.preventDefault();
            rb.style.filter = "brightness(150%)";
            rb.style.transform = "scale(0.95)";
            rb.style.transition = "all 0.1s";
            simulatedGamepad.buttons[5] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 5){
                greenToggleButton();
            }
        });
        rb.addEventListener('touchend', (e) => {
            e.preventDefault();
            rb.style.filter = "brightness(100%)";
            rb.style.transform = "scale(1)";
            simulatedGamepad.buttons[5] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 5){
                redToggleButton();
            }
        });

        let start = document.createElement('button');
        start.textContent = "START";
        start.style.background = "#444";
        start.style.opacity = opacity;
        start.style.position = "fixed";
        start.style.width = "8vw";
        start.style.height = "4vh";
        start.style.borderRadius = "10%";
        start.style.border = "none";
        start.style.color = "#FFF";
        start.style.fontSize = "3vh";
        start.style.fontFamily = "Arial, sans-serif";
        start.style.userSelect = "none";
        start.style.display = "none";
        start.style.bottom= "8vh";
        start.style.right= "40vw";
        start.style.zIndex = "9000";
        start.style.textAlign= "center";
        start.addEventListener('touchstart', (e) => {
            e.preventDefault();
            start.style.filter = "brightness(150%)";
            start.style.transform = "scale(0.95)";
            start.style.transition = "all 0.1s";
            simulatedGamepad.buttons[9] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 9){
                greenToggleButton();
            }
        });
        start.addEventListener('touchend', (e) => {
            e.preventDefault();
            start.style.filter = "brightness(100%)";
            start.style.transform = "scale(1)";
            simulatedGamepad.buttons[9] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 9){
                redToggleButton();
            }
        });

        let select = document.createElement('button');
        select.textContent = "SELECT";
        select.style.background = "#444";
        select.style.opacity = opacity;
        select.style.position = "fixed";
        select.style.width = "8vw";
        select.style.height = "4vh";
        select.style.borderRadius = "10%";
        select.style.border = "none";
        select.style.color = "#FFF";
        select.style.fontSize = "3vh";
        select.style.fontFamily = "Arial, sans-serif";
        select.style.userSelect = "none";
        select.style.display = "none";
        select.style.bottom= "8vh";
        select.style.left= "40vw";
        select.style.zIndex = "9000";
        select.style.textAlign= "center";
        select.addEventListener('touchstart', (e) => {
            e.preventDefault();
            select.style.filter = "brightness(150%)";
            select.style.transform = "scale(0.95)";
            select.style.transition = "all 0.1s";
            simulatedGamepad.buttons[8] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 8){
                greenToggleButton();
            }
        });
        select.addEventListener('touchend', (e) => {
            e.preventDefault();
            select.style.filter = "brightness(100%)";
            select.style.transform = "scale(1)";
            simulatedGamepad.buttons[8] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 8){
                redToggleButton();
            }
        });

        let l3 = document.createElement('button');
        l3.textContent = "L3";
        l3.style.background = "#444";
        l3.style.opacity = opacity;
        l3.style.position = "fixed";
        l3.style.width = "10vh";
        l3.style.height = "10vh";
        l3.style.borderRadius = "10%";
        l3.style.border = "none";
        l3.style.color = "#FFF";
        l3.style.fontSize = "3vh";
        l3.style.fontFamily = "Arial, sans-serif";
        l3.style.userSelect = "none";
        l3.style.display = "none";
        l3.style.bottom= "8vh";
        l3.style.left= "10vh";
        l3.style.zIndex = "9000";
        l3.style.textAlign= "center";
        l3.addEventListener('touchstart', (e) => {
            e.preventDefault();
            l3.style.filter = "brightness(150%)";
            l3.style.transform = "scale(0.95)";
            l3.style.transition = "all 0.1s";
            simulatedGamepad.buttons[10] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 10){
                greenToggleButton();
            }
        });
        l3.addEventListener('touchend', (e) => {
            e.preventDefault();
            l3.style.filter = "brightness(100%)";
            l3.style.transform = "scale(1)";
            simulatedGamepad.buttons[10] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 10){
                redToggleButton();
            }
        });

        let r3 = document.createElement('button');
        r3.textContent = "R3";
        r3.style.background = "#444";
        r3.style.opacity = opacity;
        r3.style.position = "fixed";
        r3.style.width = "10vh";
        r3.style.height = "10vh";
        r3.style.borderRadius = "10%";
        r3.style.border = "none";
        r3.style.color = "#FFF";
        r3.style.fontSize = "3vh";
        r3.style.fontFamily = "Arial, sans-serif";
        r3.style.userSelect = "none";
        r3.style.display = "none";
        r3.style.bottom= "8vh";
        r3.style.right= "10vh";
        r3.style.zIndex = "9000";
        r3.style.textAlign= "center";
        r3.addEventListener('touchstart', (e) => {
            e.preventDefault();
            r3.style.filter = "brightness(150%)";
            r3.style.transform = "scale(0.95)";
            r3.style.transition = "all 0.1s";
            simulatedGamepad.buttons[11] = { pressed: true, touched: true, value: 1 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 11){
                greenToggleButton();
            }
        });
        r3.addEventListener('touchend', (e) => {
            e.preventDefault();
            r3.style.filter = "brightness(100%)";
            r3.style.transform = "scale(1)";
            simulatedGamepad.buttons[11] = { pressed: false, touched: false, value: 0 };
            simulatedGamepad.timestamp = performance.now();
            if(trigger == 11){
                redToggleButton();
            }
        });

        let stickRightContainer = document.createElement('div');
        stickRightContainer.style.position = "fixed";
        stickRightContainer.style.width = "12vw";
        stickRightContainer.style.height = "12vw";
        stickRightContainer.style.background = "#444";
        stickRightContainer.style.opacity = opacity;
        stickRightContainer.style.borderRadius = "50%";
        stickRightContainer.style.bottom = "8vh";
        stickRightContainer.style.right = "20vw";
        stickRightContainer.style.display = "none";
        stickRightContainer.style.zIndex = "9000";
        let rightStick = document.createElement('div');
        rightStick.style.position = "absolute";
        rightStick.style.width = "50%";
        rightStick.style.height = "50%";
        rightStick.style.background = "#fff";
        rightStick.style.opacity = opacity;
        rightStick.style.borderRadius = "50%";
        rightStick.style.display = "flex";
        rightStick.style.justifyContent = "center";
        rightStick.style.alignItems = "center";
        rightStick.style.left = "25%";
        rightStick.style.top = "25%";
        rightStick.style.transition = "transform 0.1s";
        rightStick.style.touchAction = "none";
        let activeRightTouch = null;
        stickRightContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            for (let rigthTouch of e.touches) {
                if (stickRightContainer.contains(rigthTouch.target)) {
                    activeRightTouch = rigthTouch;
                    break;
                }
            }
            rightStickMoved = true;
            stickRightContainer.style.filter = "brightness(150%)";
            stickRightContainer.style.transform = "scale(0.95)";
            stickRightContainer.style.transition = "all 0.1s";
        });
        stickRightContainer.addEventListener('touchmove', (e) => {
            if (!activeRightTouch) return;
            rightStick.style.transition = "none";
            const containerRect = stickRightContainer.getBoundingClientRect();
            const centerX = containerRect.width / 2;
            const centerY = containerRect.height / 2;
            const touch = Array.from(e.touches).find(t => t.identifier === activeRightTouch.identifier);
            if (touch) {
                // Calcula el desplazamiento desde el centro del contenedor.
                const dx = touch.clientX - containerRect.left - centerX;
                const dy = touch.clientY - containerRect.top - centerY;
                // Normaliza cada eje de forma independiente usando stickRadius.
                let normX = dx / stickRadius;
                let normY = dy / stickRadius;
                // Calcula la magnitud del vector.
                const magnitude = Math.hypot(normX, normY);
                // Si la magnitud supera 1, reescala el vector para que su magnitud sea 1.
                if (magnitude > 1) {
                    normX /= magnitude;
                    normY /= magnitude;
                }
                // Para el movimiento visual del stick, limitamos la distancia a stickRadius.
                const realDistance = Math.hypot(dx, dy);
                const clampedDistance = Math.min(realDistance, stickRadius);
                const angle = Math.atan2(dy, dx);
                const dispX = Math.cos(angle) * clampedDistance;
                const dispY = Math.sin(angle) * clampedDistance;
                rightStick.style.transform = `translate(${dispX}px, ${dispY}px)`;
                simulatedStick.x2 = normX;
                simulatedStick.y2 = normY;
                simulatedGamepad.timestamp = performance.now();
            }
        });
        stickRightContainer.addEventListener('touchend', (e) => {
            activeRightTouch = null;
            rightStick.style.transition = "all 0.1s";
            rightStick.style.transform = 'translate(0, 0)';
            stickRightContainer.style.filter = "brightness(100%)";
            stickRightContainer.style.transform = "scale(1)";
            simulatedStick.x2 = 0;
            simulatedStick.y2 = 0;
            simulatedGamepad.timestamp = performance.now();
            rightStickMoved = false;
        });
        stickRightContainer.append(rightStick);

        let stickLeftContainer = document.createElement('div');
        stickLeftContainer.style.position = "fixed";
        stickLeftContainer.style.width = "12vw";
        stickLeftContainer.style.height = "12vw";
        stickLeftContainer.style.background = "#444";
        stickLeftContainer.style.opacity = opacity;
        stickLeftContainer.style.borderRadius = "50%";
        stickLeftContainer.style.bottom = "8vh";
        stickLeftContainer.style.left = "20vw";
        stickLeftContainer.style.display = "none";
        stickLeftContainer.style.zIndex = "9000";
        let leftStick = document.createElement('div');
        leftStick.style.position = "absolute";
        leftStick.style.width = "50%";
        leftStick.style.height = "50%";
        leftStick.style.background = "#fff";
        leftStick.style.opacity = opacity;
        leftStick.style.borderRadius = "50%";
        leftStick.style.display = "flex";
        leftStick.style.justifyContent = "center";
        leftStick.style.alignItems = "center";
        leftStick.style.left = "25%";
        leftStick.style.top = "25%";
        leftStick.style.transition = "transform 0.1s";
        leftStick.style.touchAction = "none";
        let activeLeftTouch = null;
        stickLeftContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            for (let leftTouch of e.touches) {
                if (stickLeftContainer.contains(leftTouch.target)) { // Verifica si el toque está dentro del contenedor
                    activeLeftTouch = leftTouch;
                    break;
                }
            }
            leftStickMoved = true;
            stickLeftContainer.style.filter = "brightness(150%)";
            stickLeftContainer.style.transform = "scale(0.95)";
            stickLeftContainer.style.transition = "all 0.1s";
        });
        stickLeftContainer.addEventListener('touchmove', (e) => {
            if (!activeLeftTouch) return;
            leftStick.style.transition = "none";
            const containerRect = stickLeftContainer.getBoundingClientRect();
            const centerX = containerRect.width / 2;
            const centerY = containerRect.height / 2;
            const touch = Array.from(e.touches).find(t => t.identifier === activeLeftTouch.identifier);
            if (touch) {
                // Calcula el desplazamiento desde el centro del contenedor.
                const dx = touch.clientX - containerRect.left - centerX;
                const dy = touch.clientY - containerRect.top - centerY;
                // Normaliza cada eje de forma independiente usando stickRadius.
                let normX = dx / stickRadius;
                let normY = dy / stickRadius;
                // Calcula la magnitud del vector.
                const magnitude = Math.hypot(normX, normY);
                // Si la magnitud supera 1, reescala el vector para que su magnitud sea 1.
                if (magnitude > 1) {
                    normX /= magnitude;
                    normY /= magnitude;
                }
                // Para el movimiento visual del stick, limitamos la distancia a stickRadius.
                const realDistance = Math.hypot(dx, dy);
                const clampedDistance = Math.min(realDistance, stickRadius);
                const angle = Math.atan2(dy, dx);
                const dispX = Math.cos(angle) * clampedDistance;
                const dispY = Math.sin(angle) * clampedDistance;
                leftStick.style.transform = `translate(${dispX}px, ${dispY}px)`;
                simulatedStick.x1 = normX;
                simulatedStick.y1 = normY;
                simulatedGamepad.timestamp = performance.now();
            }
        });
        stickLeftContainer.addEventListener('touchend', (e) => {
            activeLeftTouch = null;
            leftStick.style.transition = "all 0.1s";
            leftStick.style.transform = 'translate(0, 0)';
            stickLeftContainer.style.filter = "brightness(100%)";
            stickLeftContainer.style.transform = "scale(1)";
            simulatedStick.x1 = 0;
            simulatedStick.y1 = 0;
            simulatedGamepad.timestamp = performance.now();
            leftStickMoved = false;
        });
        stickLeftContainer.append(leftStick);

        let uiControllerContainer = document.createElement("div");
        uiControllerContainer.id = "controls-ui";
        uiControllerContainer.style.position = "fixed";
        uiControllerContainer.style.top = "10px";
        uiControllerContainer.style.left = "10px";
        uiControllerContainer.style.width = "30%";
        uiControllerContainer.style.padding = "10px";
        uiControllerContainer.style.background = "rgba(0,0,0,0.8)";
        uiControllerContainer.style.color = "white";
        uiControllerContainer.style.borderRadius = "10px";
        uiControllerContainer.style.fontFamily = "Arial, sans-serif";
        uiControllerContainer.style.fontSize = "3vh";
        uiControllerContainer.style.zIndex = "9999";
        uiControllerContainer.style.textAlign = "center";
        uiControllerContainer.style.boxShadow = "0px 0px 10px rgba(255,255,255,0.2)";
        uiControllerContainer.style.display = "none";
        uiControllerContainer.style.maxHeight = "80vh";
        uiControllerContainer.style.overflowY = "auto";

        let closeControllerButton = document.createElement("button");
        closeControllerButton.textContent = "❌";
        closeControllerButton.style.fontSize = "4vh";
        closeControllerButton.style.textAlign = "right";
        closeControllerButton.style.paddingRight = "10px";
        closeControllerButton.style.width = "100%";
        closeControllerButton.style.background = "#0000";
        closeControllerButton.style.color = "white";
        closeControllerButton.style.border = "none";
        closeControllerButton.style.cursor = "pointer";
        closeControllerButton.onclick = function () {
            showConfigController = !showConfigController;
            uiControllerContainer.style.display = "none";
        };

        let opacityLabel = document.createElement("label");
        opacityLabel.textContent = "Opacity: " + Math.round((opacity*100));
        let opacityInput = document.createElement("input");
        opacityInput.type = "range";
        opacityInput.min = "0";
        opacityInput.max = "1";
        opacityInput.step = "0.01";
        opacityInput.value = opacity;
        opacityInput.style.width = "100%";
        opacityInput.oninput = function () {
            opacity = parseFloat(this.value);
            updateOpacity();
            opacityLabel.textContent = "Opacity: " + Math.round(opacity*100);
        };

        let elementLabel = document.createElement("label");
        elementLabel.textContent = "Select Element To Modify:";
        let elementSelect = document.createElement("select");
        elementSelect.style.width = "100%";
        elementSelect.style.marginTop = "5px";
        elementSelect.style.backgroundColor = "#444";
        elementSelect.style.color = "white";
        let elementsNames = [
            "🚫-NONE-🚫", "A", "B", "X", "Y", "LB", "RB", "LT", "RT", "SELECT", "START", "LS", "RS",
            "DPAD UP", "DPAD DOWN", "DPAD LEFT", "DPAD RIGHT", "RIGHT STICK" , "LEFT STICK"
        ];
        elementsNames.forEach((btnName, index) => {
            let option = document.createElement("option");
            option.value = index;
            option.textContent = btnName;
            elementSelect.appendChild(option);
        });
        elementSelect.onchange = function () {
            trigger = parseInt(this.value);
            let index = trigger - 1;
            if(index == -1){
                positionXLabel.style.display = "none";
                positionYLabel.style.display = "none";
                positionXInput.style.display = "none";
                positionYInput.style.display = "none";
                if(elementSelected){
                    elementSelected.style.border = "none";
                    elementSelected.style.opacity = opacity;
                    elementSelected = null;
                }
            }else{
                uiContainer.style.display = "none";
                elementSelected = selectElement(index);
                elementSelected.style.border = "3px solid redred";
                elementSelected.style.opacity = 1;
                posX = Math.round(elementSelected.getBoundingClientRect().x);
                posY = Math.round(elementSelected.getBoundingClientRect().y);
                positionXInput.value = posX;
                positionYInput.value = posY;
                positionXLabel.textContent = "Position In X: " + posX;
                positionYLabel.textContent = "Position In Y: " + posY;
                positionXLabel.style.display = "block";
                positionYLabel.style.display = "block";
                positionXInput.style.display = "block";
                positionYInput.style.display = "block";
            }
        };

        let positionXLabel = document.createElement("label");
        positionXLabel.textContent = "Position In X: " + posX;
        positionXLabel.style.marginTop = "10px";
        positionXLabel.style.display = "none";
        let positionXInput = document.createElement("input");
        positionXInput.type = "range";
        positionXInput.min = "0";
        positionXInput.max = screenWidth;
        positionXInput.step = "1";
        positionXInput.value = posX;
        positionXInput.style.display = "none";
        positionXInput.style.width = "100%";
        positionXInput.oninput = function () {
            posX = parseFloat(this.value);
            elementSelected.style.removeProperty("left");
            elementSelected.style.removeProperty("right");
            elementSelected.style.left = `${posX}px`;
            positionXLabel.textContent = "Position In X: " + posX;
        };

        let positionYLabel = document.createElement("label");
        positionYLabel.textContent = "Position In Y: " + posY;
        positionYLabel.style.marginTop = "10px";
        positionYLabel.style.display = "none";
        let positionYInput = document.createElement("input");
        positionYInput.type = "range";
        positionYInput.min = "0";
        positionYInput.max = screenHeight;
        positionYInput.step = "1";
        positionYInput.value = posY;
        positionYInput.style.display = "none";
        positionYInput.style.width = "100%";
        positionYInput.oninput = function () {
            posY = parseFloat(this.value);
            elementSelected.style.removeProperty("top");
            elementSelected.style.removeProperty("down");
            elementSelected.style.top = `${posY}px`;
            positionYLabel.textContent = "Position In Y: " + posY;
        };

        let sizeLabel = document.createElement("label");
        sizeLabel.textContent = "Scale: " + scale;
        sizeLabel.style.marginTop = "10px";
        sizeLabel.style.display = "none";
        let sizeInput = document.createElement("input");
        sizeInput.type = "range";
        sizeInput.min = "0.5";
        sizeInput.max = "3";
        sizeInput.step = "0.5";
        sizeInput.value = scale;
        sizeInput.style.display = "none";
        sizeInput.style.width = "100%";
        sizeInput.oninput = function () {
            scale = parseFloat(this.value);
            elementSelected.style.removeProperty("top");
            elementSelected.style.removeProperty("down");
            elementSelected.style.transform = `$scale(${scale})`;
            sizeLabel.textContent = "Scale: " + scale;
        };

        let toggleButton = document.createElement("button");
        toggleButton.textContent = "✜";
        toggleButton.style.position = "fixed";
        toggleButton.style.fontSize = "5vh";
        toggleButton.style.textAlign = "center";
        toggleButton.style.fontFamily = "Arial, sans-serif";
        toggleButton.style.top = "10%";
        toggleButton.style.right = "0vw";
        toggleButton.style.background = enabled ? "#00A86B" : "#FF4D4D";
        toggleButton.style.opacity = opacity;
        toggleButton.style.opacity = 0.5;
        toggleButton.style.color = "#FFF8";
        toggleButton.style.border = "none";
        toggleButton.style.borderRadius = "50%";
        toggleButton.style.width = "8vh";
        toggleButton.style.height = "8vh";
        toggleButton.style.zIndex = "10000";

        function updateToggleButtonColor() {
            toggleButton.style.background = enabled ? "#00A86B" : "#FF4D4D";
        }

        function greenToggleButton() {
            toggleButton.style.background = "#00A86B";
        }

        function redToggleButton() {
            toggleButton.style.background = "#FF4D4D";
        }

        function showControls(){
            controllerEnable = true;
            enableController.textContent = controllerEnable ? "Disable Virtual Controller 🎮" : "Activate Virtual Controller 🎮";
            enableController.style.background = controllerEnable ? "#00A86B" : "#FF4D4D";
            configController.style.display = "block";
            buttonA.style.display = "block";
            buttonB.style.display = "block";
            buttonX.style.display = "block";
            buttonY.style.display = "block";
            up.style.display = "block";
            down.style.display = "block";
            left.style.display = "block";
            right.style.display = "block";
            lt.style.display = "block";
            rt.style.display = "block";
            lb.style.display = "block";
            rb.style.display = "block";
            l3.style.display = "block";
            r3.style.display = "block";
            select.style.display = "block";
            start.style.display = "block";
            stickLeftContainer.style.display = "block";
            stickRightContainer.style.display = "block";
        }

        function hideControls(){
            controllerEnable = false;
            enableController.textContent = controllerEnable ? "Disable Virtual Controller 🎮" : "Activate Virtual Controller 🎮";
            enableController.style.background = controllerEnable ? "#00A86B" : "#FF4D4D";
            configController.style.display = "none";
            uiControllerContainer.style.display = "none";
            buttonA.style.display = "none";
            buttonB.style.display = "none";
            buttonX.style.display = "none";
            buttonY.style.display = "none";
            up.style.display = "none";
            down.style.display = "none";
            left.style.display = "none";
            right.style.display = "none";
            lt.style.display = "none";
            rt.style.display = "none";
            lb.style.display = "none";
            rb.style.display = "none";
            l3.style.display = "none";
            r3.style.display = "none";
            select.style.display = "none";
            start.style.display = "none";
            stickLeftContainer.style.display = "none";
            stickRightContainer.style.display = "none";
        }

        function updateOpacity(){
            buttonA.style.opacity = opacity;
            buttonB.style.opacity = opacity;
            buttonX.style.opacity = opacity;
            buttonY.style.opacity = opacity;
            up.style.opacity = opacity;
            down.style.opacity = opacity;
            left.style.opacity = opacity;
            right.style.opacity = opacity;
            lt.style.opacity = opacity;
            rt.style.opacity = opacity;
            lb.style.opacity = opacity;
            rb.style.opacity = opacity;
            l3.style.opacity = opacity;
            r3.style.opacity = opacity;
            select.style.opacity = opacity;
            start.style.opacity = opacity;
            stickLeftContainer.style.opacity = opacity;
            stickRightContainer.style.opacity = opacity;
            toggleButton.style.opacity = opacity;
        }

        function selectElement(element){
            switch(element){
                case 0 :
                    return buttonA;
                case 1 :
                    return buttonB;
                case 2 :
                    return buttonX;
                case 3 :
                    return buttonY;
                case 4 :
                    return lb;
                case 5 :
                    return rb;
                case 6 :
                    return lt;
                case 7 :
                    return rt;
                case 8 :
                    return select;
                case 9 :
                    return start;
                case 10 :
                    return l3;
                case 11 :
                    return r3;
                case 12 :
                    return up;
                case 13 :
                    return down;
                case 14 :
                    return left;
                case 15 :
                    return right;
                case 16 :
                    return stickRightContainer;
                case 17 :
                    return stickLeftContainer;
            }
        }

        function showToast(message){
            const toast = document.createElement("div");
            toast.textContent = message;
            toast.style.position = "fixed";
            toast.style.textAlign= "center";
            toast.style.bottom = "20px";
            toast.style.left = "50%";
            toast.style.transform = "translateX(-50%)";
            toast.style.background = "rgba(0, 0, 0, 0.8)";
            toast.style.color = "white";
            toast.style.padding = "12px 20px";
            toast.style.borderRadius = "8px";
            toast.style.fontSize = "3vh";
            toast.style.boxShadow = "0px 4px 10px rgba(0, 0, 0, 0.3)";
            toast.style.zIndex = "9999";
            toast.style.opacity = "0";
            toast.style.transition = "opacity 0.5s ease-in-out";
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = "1";
            }, 100);
            setTimeout(() => {
                toast.style.opacity = "0";
                setTimeout(() => {
                    toast.remove();
                }, 500);
            }, 5000);

        }

        screen.orientation.addEventListener("change", function() {
            if(screen.orientation.type.includes('portrait')){
                hideControls();
            }
        });

        toggleButton.ontouchstart = function (event) {
            event.preventDefault();
            let touch = event.touches[0];
            let rect = toggleButton.getBoundingClientRect();
            let shiftX = touch.clientX - rect.left;
            let shiftY = touch.clientY - rect.top;
            let startX = touch.clientX;
            let startY = touch.clientY;
            let moved = false;
            function moveAt(clientX, clientY) {
                toggleButton.style.left = clientX - shiftX + "px";
                toggleButton.style.top = clientY - shiftY + "px";
            }
            function onTouchMove(event) {
                let currentTouch = event.touches[0];
                moveAt(currentTouch.clientX, currentTouch.clientY);
                if (Math.abs(currentTouch.clientX - startX) > 30 ||
                    Math.abs(currentTouch.clientY - startY) > 30) {
                    moved = true;
                }
            }
            function onTouchEnd() {
                document.removeEventListener("touchmove", onTouchMove);
                document.removeEventListener("touchend", onTouchEnd);
                if (!moved) {
                    uiContainer.style.display = "block";
                }
            }
            document.addEventListener("touchmove", onTouchMove);
            document.addEventListener("touchend", onTouchEnd);
        };

        document.addEventListener("fullscreenchange", () => {
            let fullscreenElement = document.getElementById("fullscreen-container") ?document.getElementById("fullscreen-container") : document.getElementById("StreamHud");
            if (fullscreenElement) {
                fullscreenElement.appendChild(toggleButton);
                fullscreenElement.appendChild(uiContainer);
                fullscreenElement.appendChild(buttonA);
                fullscreenElement.appendChild(buttonB);
                fullscreenElement.appendChild(buttonX);
                fullscreenElement.appendChild(buttonY);
                fullscreenElement.appendChild(up);
                fullscreenElement.appendChild(down);
                fullscreenElement.appendChild(right);
                fullscreenElement.appendChild(left);
                fullscreenElement.appendChild(lt);
                fullscreenElement.appendChild(rt);
                fullscreenElement.appendChild(lb);
                fullscreenElement.appendChild(rb);
                fullscreenElement.appendChild(l3);
                fullscreenElement.appendChild(r3);
                fullscreenElement.appendChild(select);
                fullscreenElement.appendChild(start);
                fullscreenElement.appendChild(stickLeftContainer);
                fullscreenElement.appendChild(stickRightContainer);
                fullscreenElement.appendChild(uiControllerContainer);
            }
        });

        uiContainer.appendChild(closeButton);
        uiContainer.appendChild(uiElements);
        uiElements.appendChild(enableController);
        uiElements.appendChild(configController);
        uiElements.appendChild(toggleEnabledButton);
        uiElements.appendChild(sensitivityLabel);
        uiElements.appendChild(sensitivityInput);
        uiElements.appendChild(deadzoneLabel);
        uiElements.appendChild(deadzoneInput);
        uiElements.appendChild(stickButton);
        uiElements.appendChild(horizontalButton);
        uiElements.appendChild(verticalButton);
        uiElements.appendChild(buttonLabel);
        uiElements.appendChild(triggerSelect);

        // ==================== Controller elements ====================

        uiControllerContainer.appendChild(closeControllerButton);
        uiControllerContainer.appendChild(opacityLabel);
        uiControllerContainer.appendChild(opacityInput);
        uiControllerContainer.appendChild(elementLabel);
        uiControllerContainer.appendChild(elementSelect);
        uiControllerContainer.appendChild(positionXLabel);
        uiControllerContainer.appendChild(positionXInput);
        uiControllerContainer.appendChild(positionYLabel);
        uiControllerContainer.appendChild(positionYInput);
        uiControllerContainer.appendChild(sizeLabel);
        uiControllerContainer.appendChild(sizeInput);
        document.body.appendChild(buttonA);
        document.body.appendChild(buttonB);
        document.body.appendChild(buttonX);
        document.body.appendChild(buttonY);
        document.body.appendChild(up);
        document.body.appendChild(down);
        document.body.appendChild(right);
        document.body.appendChild(left);
        document.body.appendChild(lt);
        document.body.appendChild(rt);
        document.body.appendChild(lb);
        document.body.appendChild(rb);
        document.body.appendChild(l3);
        document.body.appendChild(r3);
        document.body.appendChild(select);
        document.body.appendChild(start);
        document.body.appendChild(stickLeftContainer);
        document.body.appendChild(stickRightContainer);
        document.body.appendChild(toggleButton);
        document.body.appendChild(uiContainer);
        document.body.appendChild(uiControllerContainer);
    }
    createUI();
})();
