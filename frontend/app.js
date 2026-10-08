/* =========================================================

   SENTINELAI - FRONTEND JAVASCRIPT

   Real Backend / PostgreSQL Integrated Frontend

   Real-Time WebSocket Monitoring

   ========================================================= */



const API_URL = window.location.origin;





/* =========================================================

   GLOBAL STATE

   ========================================================= */



let allAlerts = [];

let currentAlertSearch = "";



let liveMonitoring = true;

let autoRefresh = true;

let aiDetection = true;



let autoRefreshInterval = null;

let currentAlertId = null;





/* =========================================================

   WEBSOCKET STATE

   ========================================================= */



let socket = null;

let websocketReconnectTimer = null;

let websocketHeartbeatInterval = null;



let websocketReconnectDelay = 3000;



const WS_URL =

    (window.location.protocol === "https:" ? "wss://" : "ws://") +

    window.location.host +

    "/ws";





/* =========================================================

   HELPER

   ========================================================= */



function setText(id, value) {



    const element = document.getElementById(id);



    if (element) {

        element.textContent = value ?? "";

    }

}





/* =========================================================

   API HELPER

   ========================================================= */



async function apiRequest(url, options = {}) {



    const response = await fetch(url, options);



    if (!response.ok) {



        let message = `HTTP ${response.status}`;



        try {



            const data = await response.json();



            if (data?.detail) {

                message = data.detail;

            }



        } catch (error) {

            // Ignore invalid JSON

        }



        throw new Error(message);

    }



    return response.json();

}





/* =========================================================

   LAST UPDATED

   ========================================================= */



function updateLastUpdated() {



    const element =

        document.getElementById("lastUpdated");



    if (!element) {

        return;

    }



    const now = new Date();



    element.textContent =

        now.toLocaleTimeString([], {

            hour: "2-digit",

            minute: "2-digit",

            second: "2-digit"

        });

}





/* =========================================================

   SYSTEM STATUS

   ========================================================= */



function updateSystemStatus(online) {



    const dot =

        document.querySelector(".status-dot");



    const title =

        document.querySelector(

            ".system-status-text, .system-status strong"

        );



    const subtitle =

        document.querySelector(

            ".system-status-subtext, .system-status small"

        );





    if (dot) {



        dot.style.background =

            online

                ? "var(--success)"

                : "var(--danger)";



        dot.style.boxShadow =

            online

                ? "0 0 10px rgba(34,197,94,.7)"

                : "0 0 10px rgba(239,68,68,.7)";

    }





    if (title) {



        title.textContent =

            online

                ? "System Operational"

                : "Backend Offline";

    }





    if (subtitle) {



        subtitle.textContent =

            online

                ? "All services running"

                : "Check FastAPI server";

    }

}





/* =========================================================

   WEBSOCKET - CONNECT

   ========================================================= */



function connectWebSocket() {



    if (!liveMonitoring) {

        return;

    }





    if (

        socket &&

        (

            socket.readyState === WebSocket.OPEN ||

            socket.readyState === WebSocket.CONNECTING

        )

    ) {

        return;

    }





    clearWebSocketReconnect();



    updateRealtimeIndicator("connecting");





    console.log(

        "[WebSocket] Connecting:",

        WS_URL

    );





    try {



        socket = new WebSocket(WS_URL);





        socket.onopen = () => {



            console.log(

                "[WebSocket] Connected"

            );





            websocketReconnectDelay = 3000;





            updateRealtimeIndicator(

                "connected"

            );





            startWebSocketHeartbeat();





            loadDashboard();



            loadAIStatus();

        };





        socket.onmessage = async (event) => {



            try {



                const data =

                    JSON.parse(event.data);





                console.log(

                    "[WebSocket] Event:",

                    data

                );





                await handleWebSocketEvent(

                    data

                );



            }



            catch (error) {



                console.error(

                    "[WebSocket] Message error:",

                    error

                );

            }

        };





        socket.onerror = (error) => {



            console.error(

                "[WebSocket] Error:",

                error

            );

        };





        socket.onclose = () => {



            console.log(

                "[WebSocket] Disconnected"

            );





            stopWebSocketHeartbeat();





            socket = null;





            if (liveMonitoring) {



                updateRealtimeIndicator(

                    "reconnecting"

                );



                scheduleWebSocketReconnect();



            }



            else {



                updateRealtimeIndicator(

                    "paused"

                );

            }



        };



    }



    catch (error) {



        console.error(

            "[WebSocket] Connection failed:",

            error

        );





        updateRealtimeIndicator(

            "offline"

        );





        scheduleWebSocketReconnect();

    }

}





/* =========================================================

   WEBSOCKET - HANDLE EVENTS

   ========================================================= */



async function handleWebSocketEvent(data) {



    if (!data) {

        return;

    }





    const eventType =

        data.event;





    switch (eventType) {



        case "connected":



            console.log(

                "[WebSocket] Backend:",

                data.message

            );





            updateRealtimeIndicator(

                "connected"

            );



            updateLastUpdated();



            break;





        case "alert_created":



            console.log(

                "[WebSocket] New alert:",

                data.alert_id

            );





            await loadDashboard();



            await loadAIStatus();



            updateLastUpdated();



            break;





        case "security_alert":



            console.log(

                "[WebSocket] Security alert:",

                data

            );





            await loadDashboard();



            await loadAIStatus();



            updateLastUpdated();





            if (

                data.alert_id &&

                currentAlertId === data.alert_id

            ) {



                viewAlert(

                    data.alert_id

                );

            }





            break;





        case "alert_status_updated":



            console.log(

                "[WebSocket] Alert status updated:",

                data.alert_id,

                data.status

            );





            await loadDashboard();



            updateLastUpdated();



            break;





        default:



            console.log(

                "[WebSocket] Unknown event:",

                data

            );



            break;

    }

}





/* =========================================================

   WEBSOCKET - HEARTBEAT

   ========================================================= */



function startWebSocketHeartbeat() {



    stopWebSocketHeartbeat();





    websocketHeartbeatInterval =

        setInterval(

            () => {



                if (

                    socket &&

                    socket.readyState === WebSocket.OPEN

                ) {



                    try {



                        socket.send("ping");



                    }



                    catch (error) {



                        console.error(

                            "[WebSocket] Heartbeat error:",

                            error

                        );

                    }

                }



            },

            25000

        );

}





/* =========================================================

   WEBSOCKET - STOP HEARTBEAT

   ========================================================= */



function stopWebSocketHeartbeat() {



    if (

        websocketHeartbeatInterval !== null

    ) {



        clearInterval(

            websocketHeartbeatInterval

        );





        websocketHeartbeatInterval =

            null;

    }

}





/* =========================================================

   WEBSOCKET - RECONNECT

   ========================================================= */



function scheduleWebSocketReconnect() {



    if (!liveMonitoring) {

        return;

    }





    if (

        websocketReconnectTimer !== null

    ) {

        return;

    }





    websocketReconnectTimer =

        setTimeout(

            () => {



                websocketReconnectTimer =

                    null;



                if (liveMonitoring) {



                    connectWebSocket();

                }



            },

            websocketReconnectDelay

        );





    websocketReconnectDelay =

        Math.min(

            websocketReconnectDelay * 2,

            30000

        );

}





/* =========================================================

   WEBSOCKET - CLEAR RECONNECT

   ========================================================= */



function clearWebSocketReconnect() {



    if (

        websocketReconnectTimer !== null

    ) {



        clearTimeout(

            websocketReconnectTimer

        );





        websocketReconnectTimer =

            null;

    }

}





/* =========================================================

   WEBSOCKET - DISCONNECT

   ========================================================= */



function disconnectWebSocket() {



    clearWebSocketReconnect();



    stopWebSocketHeartbeat();





    if (socket) {



        try {



            if (

                socket.readyState === WebSocket.OPEN ||

                socket.readyState === WebSocket.CONNECTING

            ) {



                socket.close();

            }



        }



        catch (error) {



            console.error(

                "[WebSocket] Close error:",

                error

            );

        }

    }





    socket = null;





    updateRealtimeIndicator(

        "paused"

    );

}





/* =========================================================

   REAL-TIME INDICATOR

   ========================================================= */



function updateRealtimeIndicator(

    state

) {



    const badges =

        document.querySelectorAll(

            ".live-badge"

        );





    badges.forEach(

        badge => {



            badge.classList.remove(

                "paused"

            );





            switch (state) {



                case "connected":



                    badge.textContent =

                        "● LIVE";



                    break;





                case "connecting":



                    badge.textContent =

                        "● CONNECTING";



                    break;





                case "reconnecting":



                    badge.textContent =

                        "● RECONNECTING";



                    break;





                case "offline":



                    badge.textContent =

                        "● OFFLINE";



                    badge.classList.add(

                        "paused"

                    );



                    break;





                case "paused":



                    badge.textContent =

                        "● PAUSED";



                    badge.classList.add(

                        "paused"

                    );



                    break;





                default:



                    badge.textContent =

                        liveMonitoring

                            ? "● LIVE"

                            : "● PAUSED";

            }

        }

    );





    const toggle =

        document.getElementById(

            "liveMonitoringToggle"

        );





    if (toggle) {



        toggle.checked =

            liveMonitoring;

    }

}





/* =========================================================

   SECURITY EVENT SIMULATOR

   ========================================================= */



async function simulateSecurityEvent() {



    const button =

        document.querySelector(".simulate-button");





    const eventType =

        document.getElementById("eventType")?.value ||

        "login";





    const username =

        document.getElementById("username")?.value.trim() ||

        "unknown";





    const sourceIP =

        document.getElementById("sourceIP")?.value.trim() ||

        "0.0.0.0";





    const failedAttempts =

        Number(

            document.getElementById("failedAttempts")?.value || 0

        );





    const loginStatus =

        document.getElementById("loginStatus")?.value ||

        "success";





    const event = {



        event_type: eventType,



        username: username,



        source_ip: sourceIP,



        failed_attempts: failedAttempts,



        status: loginStatus,



        login_hour: new Date().getHours(),



        unique_ips: 1,



        suspicious_ips: [

            "185.10.20.30"

        ],



        ai_detection_enabled: aiDetection

    };





    if (button) {



        button.disabled = true;



        button.dataset.oldText =

            button.textContent;



        button.textContent =

            "Analyzing...";

    }





    showSecurityResultLoading();





    try {



        const data =

            await apiRequest(

                `${API_URL}/analyze`,

                {

                    method: "POST",



                    headers: {

                        "Content-Type":

                            "application/json"

                    },



                    body:

                        JSON.stringify(event)

                }

            );





        showSecurityResult(data);





        await loadDashboard();



        await loadAIStatus();



        updateSystemStatus(true);



    }



    catch (error) {



        console.error(

            "Security analysis error:",

            error

        );





        showSecurityResultError(

            error.message

        );





        updateSystemStatus(false);

    }



    finally {



        if (button) {



            button.disabled = false;



            button.textContent =

                button.dataset.oldText ||

                "Analyze Security Event";

        }

    }

}





/* =========================================================

   SECURITY RESULT - LOADING

   ========================================================= */



function showSecurityResultLoading() {



    const result =

        document.getElementById(

            "securityResult"

        );





    if (!result) {

        return;

    }





    result.classList.remove(

        "hidden",

        "threat",

        "safe"

    );





    result.classList.add("safe");





    setText(

        "securityResultTitle",

        "Analyzing Security Event..."

    );





    setText(

        "securityResultBadge",

        "ANALYZING"

    );





    setText(

        "securityResultRule",

        "Running detection rules..."

    );





    setText(

        "securityResultSeverity",

        "..."

    );





    setText(

        "securityResultRisk",

        "..."

    );





    setText(

        "securityResultAI",

        aiDetection

            ? "Running AI anomaly detection..."

            : "AI detection is disabled."

    );

}





/* =========================================================

   SECURITY RESULT

   ========================================================= */



function showSecurityResult(data) {



    const result =

        document.getElementById(

            "securityResult"

        );





    if (!result) {

        return;

    }





    result.classList.remove(

        "hidden",

        "threat",

        "safe"

    );





    const ruleAnalysis =

        data?.rule_analysis || {};





    const aiAnalysis =

        data?.ai_analysis || {};





    const ruleDetected =

        ruleAnalysis.detected === true;





    const aiDetected =

        aiAnalysis.anomaly_detected === true;





    const threatDetected =

        data?.message === "Security threat detected" ||

        ruleDetected ||

        aiDetected;





    if (threatDetected) {



        result.classList.add("threat");





        setText(

            "securityResultTitle",

            "Security Threat Detected"

        );





        setText(

            "securityResultBadge",

            "THREAT"

        );





        if (ruleDetected) {



            setText(

                "securityResultRule",

                ruleAnalysis.rule ||

                "SECURITY_RULE"

            );





            setText(

                "securityResultSeverity",

                ruleAnalysis.severity ||

                "MEDIUM"

            );





            setText(

                "securityResultRisk",

                `${ruleAnalysis.risk_score ?? 0}/100`

            );

        }



        else if (aiDetected) {



            setText(

                "securityResultRule",

                "AI_ANOMALY"

            );





            setText(

                "securityResultSeverity",

                "MEDIUM"

            );





            setText(

                "securityResultRisk",

                "70/100"

            );

        }



        else {



            setText(

                "securityResultRule",

                "SECURITY_THREAT"

            );





            setText(

                "securityResultSeverity",

                "MEDIUM"

            );





            setText(

                "securityResultRisk",

                "0/100"

            );

        }





        setText(

            "securityResultAI",

            aiAnalysis.message ||

            "AI analysis completed"

        );





        return;

    }





    result.classList.add("safe");





    setText(

        "securityResultTitle",

        "No Security Threat Detected"

    );





    setText(

        "securityResultBadge",

        "SAFE"

    );





    setText(

        "securityResultRule",

        ruleAnalysis.rule ||

        "NO_THREAT"

    );





    setText(

        "securityResultSeverity",

        ruleAnalysis.severity ||

        "LOW"

    );





    setText(

        "securityResultRisk",

        `${ruleAnalysis.risk_score ?? 0}/100`

    );





    setText(

        "securityResultAI",

        aiAnalysis.message ||

        (

            aiDetection

                ? "AI model detected normal activity"

                : "AI detection is disabled"

        )

    );

}





/* =========================================================

   SECURITY RESULT ERROR

   ========================================================= */



function showSecurityResultError(message) {



    const result =

        document.getElementById(

            "securityResult"

        );





    if (!result) {

        return;

    }





    result.classList.remove(

        "hidden",

        "safe"

    );





    result.classList.add("threat");





    setText(

        "securityResultTitle",

        "Analysis Failed"

    );





    setText(

        "securityResultBadge",

        "ERROR"

    );





    setText(

        "securityResultRule",

        "Backend Error"

    );





    setText(

        "securityResultSeverity",

        "N/A"

    );





    setText(

        "securityResultRisk",

        "N/A"

    );





    setText(

        "securityResultAI",

        message ||

        "Unable to analyze security event"

    );

}





/* =========================================================

   AI STATUS

   ========================================================= */



async function loadAIStatus() {



    try {



        const data =

            await apiRequest(

                `${API_URL}/ai-status`

            );





        setText(

            "aiStatus",

            data.status || "UNKNOWN"

        );





        setText(

            "aiEngineAnomalies",

            data.anomalies_detected ?? 0

        );





        setText(

            "aiEngineModel",

            data.model || "Unknown"

        );





        setText(

            "aiEngineDetection",

            aiDetection

                ? (

                    data.anomaly_detection ||

                    "UNKNOWN"

                )

                : "DISABLED"

        );





        setText(

            "aiEngineAnalyzed",

            data.total_analyzed ?? 0

        );





        setText(

            "aiEngineLatestScore",

            data.latest_anomaly_score ?? "N/A"

        );

        const anomalyScore =

            Number(data.latest_anomaly_score);



        let scorePercent = 50;



        if (!Number.isNaN(anomalyScore)) {



            scorePercent =

                Math.max(

                    0,

                    Math.min(

                        100,

                        (anomalyScore + 0.2) * 250

                    )

                );



        }



        const scoreBar =

            document.getElementById(

                "aiScoreBar"

            );



        if (scoreBar) {



            scoreBar.style.width =

                `${scorePercent}%`;



        }





        const dashboardStatus =

            document.getElementById(

                "dashboardAIStatus"

            );





        if (dashboardStatus) {



            const status =

                aiDetection

                    ? (data.status || "UNKNOWN")

                    : "DISABLED";





            dashboardStatus.textContent =

                status;





            dashboardStatus.classList.remove(

                "online",

                "offline"

            );





            if (

                aiDetection &&

                String(data.status).toUpperCase() ===

                "ONLINE"

            ) {



                dashboardStatus.classList.add(

                    "online"

                );



            }



            else {



                dashboardStatus.classList.add(

                    "offline"

                );

            }

        }





        setText(

            "dashboardAIModel",

            data.model || "Unknown"

        );





        setText(

            "dashboardAIAnomalies",

            data.anomalies_detected ?? 0

        );





        setText(

            "dashboardAIEngine",

            aiDetection

                ? (data.status || "UNKNOWN")

                : "DISABLED"

        );





        setText(

            "dashboardAIDetection",

            aiDetection

                ? (

                    data.anomaly_detection ||

                    "UNKNOWN"

                )

                : "DISABLED"

        );





        setText(

            "dashboardAILatestScore",

            data.latest_anomaly_score ?? "N/A"

        );





        let threatLevel = "NORMAL";



        if (anomalyScore < -0.05) {



            threatLevel = "HIGH";



        }

        else if (anomalyScore < 0) {



            threatLevel = "SUSPICIOUS";



        }



        setText(

            "aiEngineThreatLevel",

            threatLevel

        );





        setText(

            "settingsAIDetection",

            aiDetection

                ? (

                    data.anomaly_detection ||

                    "UNKNOWN"

                )

                : "DISABLED"

        );





        const settingsStatus =

            document.getElementById(

                "settingsAIStatus"

            );





        if (settingsStatus) {



            const status =

                aiDetection

                    ? (data.status || "UNKNOWN")

                    : "DISABLED";





            settingsStatus.textContent =

                status;





            settingsStatus.classList.remove(

                "online",

                "offline"

            );





            if (

                aiDetection &&

                String(data.status).toUpperCase() ===

                "ONLINE"

            ) {



                settingsStatus.classList.add(

                    "online"

                );



            }



            else {



                settingsStatus.classList.add(

                    "offline"

                );

            }

        }





        updateLastUpdated();



    }



    catch (error) {



        console.error(

            "AI status error:",

            error

        );





        setText(

            "aiStatus",

            "OFFLINE"

        );





        setText(

            "dashboardAIEngine",

            "OFFLINE"

        );





        setText(

            "dashboardAIDetection",

            "OFFLINE"

        );





        setText(

            "settingsAIDetection",

            "OFFLINE"

        );





        const dashboardStatus =

            document.getElementById(

                "dashboardAIStatus"

            );





        if (dashboardStatus) {



            dashboardStatus.textContent =

                "OFFLINE";





            dashboardStatus.classList.remove(

                "online"

            );





            dashboardStatus.classList.add(

                "offline"

            );

        }





        const settingsStatus =

            document.getElementById(

                "settingsAIStatus"

            );





        if (settingsStatus) {



            settingsStatus.textContent =

                "OFFLINE";





            settingsStatus.classList.remove(

                "online"

            );





            settingsStatus.classList.add(

                "offline"

            );

        }

    }

}





/* =========================================================

   LOAD DASHBOARD

   ========================================================= */

async function loadDashboard() {



    try {



        const data =

            await apiRequest(

                `${API_URL}/alerts`

            );





        if (Array.isArray(data)) {



            allAlerts = data;



        }



        else if (Array.isArray(data?.alerts)) {



            allAlerts =

                data.alerts;



        }



        else {



            allAlerts = [];

        }





        updateStatistics();



        updateThreatOverview();



        refreshVisibleAlerts();



        updateLastUpdated();



        updateSystemStatus(true);



    }



    catch (error) {



        console.error(

            "Dashboard error:",

            error

        );





        allAlerts = [];



        updateStatistics();



        updateThreatOverview();



        displayAlerts([]);



        updateSystemStatus(false);

    }

}





/* =========================================================

   REFRESH DASHBOARD

   ========================================================= */



async function refreshDashboard() {



    const button =

        document.getElementById(

            "refreshButton"

        );





    if (button) {



        button.disabled = true;



        button.classList.add(

            "refreshing"

        );

    }





    try {



        await Promise.all([

            loadDashboard(),

            loadAIStatus()

        ]);



    }



    finally {



        setTimeout(

            () => {



                if (button) {



                    button.disabled = false;



                    button.classList.remove(

                        "refreshing"

                    );

                }



            },

            350

        );

    }

}





/* =========================================================

   STATISTICS

   ========================================================= */



function updateStatistics() {



    const total =

        allAlerts.length;





    const critical =

        allAlerts.filter(

            alert =>

                String(alert.severity)

                    .toUpperCase() ===

                "CRITICAL"

        ).length;





    const high =

        allAlerts.filter(

            alert =>

                String(alert.severity)

                    .toUpperCase() ===

                "HIGH"

        ).length;





    const resolved =

        allAlerts.filter(

            alert =>

                String(alert.status)

                    .toUpperCase() ===

                "RESOLVED"

        ).length;





    setText(

        "totalAlerts",

        total

    );





    setText(

        "criticalAlerts",

        critical

    );





    setText(

        "highAlerts",

        high

    );





    setText(

        "resolvedAlerts",

        resolved

    );





    setText(

        "alertCount",

        total

    );

}





/* =========================================================

   THREAT OVERVIEW

   ========================================================= */



function updateThreatOverview() {



    const total =

        allAlerts.length;





    const critical =

        allAlerts.filter(

            alert =>

                String(alert.severity)

                    .toUpperCase() ===

                "CRITICAL"

        ).length;





    const high =

        allAlerts.filter(

            alert =>

                String(alert.severity)

                    .toUpperCase() ===

                "HIGH"

        ).length;





    const medium =

        allAlerts.filter(

            alert =>

                String(alert.severity)

                    .toUpperCase() ===

                "MEDIUM"

        ).length;





    const low =

        allAlerts.filter(

            alert =>

                String(alert.severity)

                    .toUpperCase() ===

                "LOW"

        ).length;





    setText(

        "criticalThreatCount",

        critical

    );





    setText(

        "highThreatCount",

        high

    );





    setText(

        "mediumThreatCount",

        medium

    );





    setText(

        "lowThreatCount",

        low

    );





    updateRiskBar(

        "critical",

        critical,

        total

    );





    updateRiskBar(

        "high",

        high,

        total

    );





    updateRiskBar(

        "medium",

        medium,

        total

    );





    updateRiskBar(

        "low",

        low,

        total

    );

}





/* =========================================================

   RISK BAR

   ========================================================= */



function updateRiskBar(

    type,

    count,

    total

) {



    const possibleIds = [

        `${type}Bar`,

        `${type}Fill`

    ];





    let bar = null;





    for (const id of possibleIds) {



        bar =

            document.getElementById(id);



        if (bar) {

            break;

        }

    }





    if (!bar) {



        bar =

            document.querySelector(

                `.${type}-fill`

            );

    }





    if (!bar) {

        return;

    }





    const percentage =

        total > 0

            ? Math.round(

                (count / total) * 100

            )

            : 0;





    bar.style.width =

        `${percentage}%`;

}





/* =========================================================

   DISPLAY ALERTS

   ========================================================= */



function displayAlerts(alerts) {



    const dashboardBody =

        document.getElementById(

            "alertsTableBody"

        );





    const alertsPageBody =

        document.getElementById(

            "alertsPageTableBody"

        );





    if (

        !Array.isArray(alerts) ||

        alerts.length === 0

    ) {



        if (dashboardBody) {



            dashboardBody.innerHTML = `

                <tr>

                    <td colspan="8" class="empty-state">

                        No security alerts found

                    </td>

                </tr>

            `;

        }





        if (alertsPageBody) {



            alertsPageBody.innerHTML = `

                <tr>

                    <td colspan="8" class="empty-state">

                        No security alerts found

                    </td>

                </tr>

            `;

        }





        return;

    }





    if (dashboardBody) {



        dashboardBody.innerHTML = "";





        alerts.forEach(

            alert => {



                const row =

                    document.createElement(

                        "tr"

                    );





                const severity =

                    String(

                        alert.severity ||

                        "LOW"

                    ).toUpperCase();





                const status =

                    String(

                        alert.status ||

                        "NEW"

                    ).toUpperCase();





                row.innerHTML = `



                    <td>

                        ${escapeHtml(

                    alert.id ??

                    "N/A"

                )}

                    </td>



                    <td>

                        <strong>

                            ${escapeHtml(

                    alert.title ||

                    "Unknown Alert"

                )}

                        </strong>

                    </td>



                    <td>

                        <small>

                            ${escapeHtml(

                    alert.rule ||

                    "N/A"

                )}

                        </small>

                    </td>



                    <td>

                        <span

                            class="severity ${escapeHtml(severity)}">

                            ${escapeHtml(severity)}

                        </span>

                    </td>



                    <td>

                        ${escapeHtml(

                    alert.risk_score ??

                    0

                )}

                    </td>



                    <td>

                        ${escapeHtml(

                    alert.source_ip ||

                    "N/A"

                )}

                    </td>



                    <td>

                        <span

                            class="status ${escapeHtml(status)}">

                            ${escapeHtml(status)}

                        </span>

                    </td>



                    <td>

                        <button

                            type="button"

                            class="investigate-btn"

                            onclick="viewAlert(${Number(alert.id)})">

                            Investigate

                        </button>

                    </td>

                `;





                dashboardBody.appendChild(

                    row

                );

            }

        );

    }





    if (alertsPageBody) {



        alertsPageBody.innerHTML = "";





        alerts.forEach(

            alert => {



                const row =

                    document.createElement(

                        "tr"

                    );





                const severity =

                    String(

                        alert.severity ||

                        "LOW"

                    ).toUpperCase();





                const status =

                    String(

                        alert.status ||

                        "NEW"

                    ).toUpperCase();





                row.innerHTML = `



                    <td>

                        ${escapeHtml(

                    alert.id ??

                    "N/A"

                )}

                    </td>



                    <td>

                        <strong>

                            ${escapeHtml(

                    alert.title ||

                    "Unknown Alert"

                )}

                        </strong>



                        <br>



                        <small>

                            ${escapeHtml(

                    alert.rule ||

                    "N/A"

                )}

                        </small>

                    </td>



                    <td>

                        ${escapeHtml(

                    alert.rule ||

                    "N/A"

                )}

                    </td>



                    <td>

                        <span

                            class="severity ${escapeHtml(severity)}">

                            ${escapeHtml(severity)}

                        </span>

                    </td>



                    <td>

                        ${escapeHtml(

                    alert.risk_score ??

                    0

                )}

                    </td>



                    <td>

                        ${escapeHtml(

                    alert.source_ip ||

                    "N/A"

                )}

                    </td>



                    <td>

                        <span

                            class="status ${escapeHtml(status)}">

                            ${escapeHtml(status)}

                        </span>

                    </td>



                    <td>

                        <button

                            type="button"

                            class="investigate-btn"

                            onclick="viewAlert(${Number(alert.id)})">

                            Investigate

                        </button>

                    </td>

                `;





                alertsPageBody.appendChild(

                    row

                );

            }

        );

    }

}





/* =========================================================

   SEARCH DASHBOARD ALERTS

   ========================================================= */



function searchAlerts() {



    const input =

        document.getElementById(

            "alertSearch"

        );





    if (!input) {

        return;

    }





    const query =

        input.value

            .trim()

            .toLowerCase();





    if (!query) {



        displayAlerts(

            allAlerts

        );



        return;

    }





    displayAlerts(

        filterAlerts(query)

    );

}





/* =========================================================

   SEARCH ALERTS PAGE

   ========================================================= */



function searchAlertsPage() {



    const input =

        document.getElementById(

            "alertsPageSearch"

        );





    if (!input) {

        return;

    }





    const query =

        input.value

            .trim()

            .toLowerCase();





    currentAlertSearch =

        query;





    if (!query) {



        displayAlerts(

            allAlerts

        );



        return;

    }





    displayAlerts(

        filterAlerts(query)

    );

}





/* =========================================================

   FILTER ALERTS

   ========================================================= */



function filterAlerts(query) {



    return allAlerts.filter(

        alert => {



            const content = [



                alert.id,

                alert.title,

                alert.rule,

                alert.severity,

                alert.status,

                alert.risk_score,

                alert.source_ip,

                alert.username



            ]

                .filter(

                    value =>

                        value !== null &&

                        value !== undefined

                )

                .join(" ")

                .toLowerCase();





            return content.includes(

                query

            );

        }

    );

}





/* =========================================================

   REFRESH VISIBLE ALERTS

   ========================================================= */



function refreshVisibleAlerts() {



    /* =====================================================

       ALERTS PAGE SEARCH

       ===================================================== */



    const alertsPageSearch =

        document.getElementById(

            "alertsPageSearch"

        );





    const alertsPageQuery =

        alertsPageSearch?.value

            .trim()

            .toLowerCase() || "";





    if (alertsPageQuery) {



        currentAlertSearch =

            alertsPageQuery;





        displayAlerts(

            filterAlerts(

                alertsPageQuery

            )

        );



        return;

    }





    /* =====================================================

       DASHBOARD SEARCH

       ===================================================== */



    const dashboardSearch =

        document.getElementById(

            "alertSearch"

        );





    const dashboardQuery =

        dashboardSearch?.value

            .trim()

            .toLowerCase() || "";





    if (dashboardQuery) {



        displayAlerts(

            filterAlerts(

                dashboardQuery

            )

        );



        return;

    }





    /* =====================================================

       NO SEARCH

       ===================================================== */



    displayAlerts(

        allAlerts

    );

}



/* =========================================================

   VIEW ALERT

   ========================================================= */



async function viewAlert(alertId) {



    if (!alertId) {

        return;

    }





    try {



        const alert =

            await apiRequest(

                `${API_URL}/alerts/${alertId}`

            );





        currentAlertId =

            alert.id;





        setText(

            "modalAlertTitle",

            alert.title ||

            "Security Alert"

        );





        setText(

            "modalAlertSeverity",

            alert.severity ||

            "N/A"

        );





        setText(

            "modalAlertRule",

            alert.rule ||

            "N/A"

        );





        setText(

            "modalAlertRisk",

            alert.risk_score ??

            0

        );





        setText(

            "modalAlertStatus",

            alert.status ||

            "NEW"

        );





        setText(

            "modalAlertIP",

            alert.source_ip ||

            "N/A"

        );





        setText(

            "modalAlertUsername",

            alert.username ||

            "N/A"

        );





        setText(

            "modalAlertTime",

            formatDate(

                alert.created_at

            )

        );





        setText(

            "modalAlertAI",

            alert.ai_anomaly

                ? `Anomaly detected (${alert.ai_anomaly_score ?? "N/A"})`

                : "No AI anomaly detected"

        );





        openInvestigationModal();



    }



    catch (error) {



        console.error(

            "View alert error:",

            error

        );





        window.alert(

            "Unable to load alert details."

        );

    }

}





/* =========================================================

   OPEN MODAL

   ========================================================= */



function openInvestigationModal() {



    const modal =

        document.getElementById(

            "investigationModal"

        );





    if (!modal) {

        return;

    }





    modal.classList.add(

        "active"

    );

}





/* =========================================================

   CLOSE MODAL

   ========================================================= */



function closeInvestigationModal() {



    const modal =

        document.getElementById(

            "investigationModal"

        );





    if (!modal) {

        return;

    }





    modal.classList.remove(

        "active"

    );





    currentAlertId =

        null;

}





/* =========================================================

   UPDATE ALERT STATUS

   ========================================================= */



async function updateAlertStatus(

    newStatus

) {



    if (!currentAlertId) {



        window.alert(

            "No alert selected."

        );



        return;

    }





    try {



        await apiRequest(

            `${API_URL}/alerts/${currentAlertId}/status`,

            {

                method: "PATCH",



                headers: {

                    "Content-Type":

                        "application/json"

                },



                body:

                    JSON.stringify({

                        status:

                            newStatus

                    })

            }

        );





        await loadDashboard();





        closeInvestigationModal();



    }



    catch (error) {



        console.error(

            "Status update error:",

            error

        );





        window.alert(

            error.message ||

            "Unable to update alert status."

        );

    }

}







   /* =========================================================

   SENTINELAI - ADVANCED SETTINGS & MONITORING CONTROL

   ========================================================= */





/* =========================================================

   SETTINGS STORAGE KEYS

   ========================================================= */



const SETTINGS_KEYS = {



    liveMonitoring:

        "sentinel_live_monitoring",



    autoRefresh:

        "sentinel_auto_refresh",



    aiDetection:

        "sentinel_ai_detection"

};





/* =========================================================

   DEFAULT SETTINGS

   ========================================================= */



const DEFAULT_SETTINGS = {



    liveMonitoring: true,



    autoRefresh: true,



    aiDetection: true

};





/* =========================================================

   GET CURRENT SETTINGS

   ========================================================= */



function getCurrentSettings() {



    return {



        liveMonitoring:

            liveMonitoring === true,



        autoRefresh:

            autoRefresh === true,



        aiDetection:

            aiDetection === true

    };

}





/* =========================================================

   SAVE MONITORING PREFERENCES

   ========================================================= */



function saveMonitoringPreferences() {



    try {



        localStorage.setItem(

            SETTINGS_KEYS.liveMonitoring,

            String(liveMonitoring)

        );





        localStorage.setItem(

            SETTINGS_KEYS.autoRefresh,

            String(autoRefresh)

        );





        localStorage.setItem(

            SETTINGS_KEYS.aiDetection,

            String(aiDetection)

        );





        console.log(

            "[Settings] Preferences saved:",

            getCurrentSettings()

        );



    }



    catch (error) {



        console.error(

            "[Settings] Unable to save preferences:",

            error

        );

    }

}





/* =========================================================

   LOAD SAVED SETTINGS

   ========================================================= */



function loadSecuritySettings() {



    try {



        const savedLive =

            localStorage.getItem(

                SETTINGS_KEYS.liveMonitoring

            );





        const savedAuto =

            localStorage.getItem(

                SETTINGS_KEYS.autoRefresh

            );





        const savedAI =

            localStorage.getItem(

                SETTINGS_KEYS.aiDetection

            );





        /*

         * Only override defaults when a saved

         * value actually exists.

         */



        liveMonitoring =

            savedLive !== null

                ? savedLive === "true"

                : DEFAULT_SETTINGS.liveMonitoring;





        autoRefresh =

            savedAuto !== null

                ? savedAuto === "true"

                : DEFAULT_SETTINGS.autoRefresh;





        aiDetection =

            savedAI !== null

                ? savedAI === "true"

                : DEFAULT_SETTINGS.aiDetection;





        updateSettingsUI();





        console.log(

            "[Settings] Preferences loaded:",

            getCurrentSettings()

        );



    }



    catch (error) {



        console.error(

            "[Settings] Unable to load preferences:",

            error

        );





        /*

         * Fallback to safe defaults.

         */



        liveMonitoring =

            DEFAULT_SETTINGS.liveMonitoring;



        autoRefresh =

            DEFAULT_SETTINGS.autoRefresh;



        aiDetection =

            DEFAULT_SETTINGS.aiDetection;





        updateSettingsUI();

    }

}





/* =========================================================

   UPDATE SETTINGS UI

   ========================================================= */



function updateSettingsUI() {



    const liveToggle =

        document.getElementById(

            "liveMonitoringToggle"

        );





    const autoToggle =

        document.getElementById(

            "autoRefreshToggle"

        );





    const aiToggle =

        document.getElementById(

            "aiDetectionToggle"

        );





    if (liveToggle) {



        liveToggle.checked =

            liveMonitoring;

    }





    if (autoToggle) {



        autoToggle.checked =

            autoRefresh;

    }





    if (aiToggle) {



        aiToggle.checked =

            aiDetection;

    }





    updateLiveIndicator();

}





/* =========================================================

   APPLY ALL MONITORING SETTINGS

   ========================================================= */



function applyMonitoringState() {



    console.log(

        "[Settings] Applying monitoring state:",

        getCurrentSettings()

    );





    /*

     * AUTO REFRESH

     */



    if (

        liveMonitoring &&

        autoRefresh

    ) {



        startAutoRefresh();



    }



    else {



        stopAutoRefresh();

    }





    /*

     * LIVE MONITORING / WEBSOCKET

     */



    if (liveMonitoring) {



        connectWebSocket();



        loadDashboard();



        loadAIStatus();



    }



    else {



        disconnectWebSocket();

    }





    /*

     * Update UI

     */



    updateSettingsUI();



    updateLiveIndicator();

}





/* =========================================================

   LIVE MONITORING TOGGLE

   ========================================================= */



function toggleLiveMonitoring() {



    liveMonitoring =

        !liveMonitoring;





    saveMonitoringPreferences();



    updateSettingsUI();



    updateLiveIndicator();



    applyMonitoringState();

}





/* =========================================================

   SETTINGS LIVE TOGGLE

   ========================================================= */



function handleLiveToggle(

    enabled

) {



    liveMonitoring =

        enabled === true;





    saveMonitoringPreferences();



    updateSettingsUI();



    updateLiveIndicator();



    applyMonitoringState();





    console.log(

        "[Settings] Live Monitoring:",

        liveMonitoring

    );

}





/* =========================================================

   LIVE INDICATOR

   ========================================================= */



function updateLiveIndicator() {



    const toggle =

        document.getElementById(

            "liveMonitoringToggle"

        );





    if (toggle) {



        toggle.checked =

            liveMonitoring;

    }





    /*

     * If monitoring is OFF

     */



    if (!liveMonitoring) {



        updateRealtimeIndicator(

            "paused"

        );



        return;

    }





    /*

     * WebSocket connected

     */



    if (

        socket &&

        socket.readyState === WebSocket.OPEN

    ) {



        updateRealtimeIndicator(

            "connected"

        );



        return;

    }





    /*

     * WebSocket connecting

     */



    if (

        socket &&

        socket.readyState === WebSocket.CONNECTING

    ) {



        updateRealtimeIndicator(

            "connecting"

        );



        return;

    }





    /*

     * Monitoring enabled but

     * WebSocket not connected yet.

     */



    updateRealtimeIndicator(

        "connecting"

    );

}





/* =========================================================

   AUTO REFRESH TOGGLE

   ========================================================= */



function toggleAutoRefresh(

    enabled

) {



    autoRefresh =

        enabled === true;





    saveMonitoringPreferences();



    applyMonitoringState();





    console.log(

        "[Settings] Auto Refresh:",

        autoRefresh

    );

}





/* =========================================================

   SETTINGS AUTO REFRESH TOGGLE

   ========================================================= */



function handleAutoRefreshToggle(

    enabled

) {



    toggleAutoRefresh(

        enabled

    );

}





/* =========================================================

   AI DETECTION TOGGLE

   ========================================================= */



function handleAIDetectionToggle(

    enabled

) {



    aiDetection =

        enabled === true;





    saveMonitoringPreferences();



    updateSettingsUI();



    loadAIStatus();





    console.log(

        "[Settings] AI Detection:",

        aiDetection

    );

}





/* =========================================================

   START AUTO REFRESH

   ========================================================= */



function startAutoRefresh() {



    /*

     * Always clear old interval first.

     * Prevents duplicate timers.

     */



    stopAutoRefresh();





    if (

        !autoRefresh ||

        !liveMonitoring

    ) {



        console.log(

            "[Auto Refresh] Disabled"

        );



        return;

    }





    console.log(

        "[Auto Refresh] Started"

    );





    autoRefreshInterval =

        setInterval(

            async () => {



                /*

                 * Safety check

                 */



                if (

                    !autoRefresh ||

                    !liveMonitoring

                ) {



                    return;

                }





                try {



                    await loadDashboard();



                    await loadAIStatus();



                }



                catch (error) {



                    console.error(

                        "[Auto Refresh] Error:",

                        error

                    );

                }



            },

            10000

        );

}





/* =========================================================

   STOP AUTO REFRESH

   ========================================================= */



function stopAutoRefresh() {



    if (

        autoRefreshInterval !== null

    ) {



        clearInterval(

            autoRefreshInterval

        );





        autoRefreshInterval =

            null;





        console.log(

            "[Auto Refresh] Stopped"

        );

    }

}





/* =========================================================

   SAVE SETTINGS BUTTON

   ========================================================= */



function saveSecuritySettings() {



    const liveToggle =

        document.getElementById(

            "liveMonitoringToggle"

        );





    const autoToggle =

        document.getElementById(

            "autoRefreshToggle"

        );





    const aiToggle =

        document.getElementById(

            "aiDetectionToggle"

        );





    /*

     * Read current checkbox values

     */



    if (liveToggle) {



        liveMonitoring =

            liveToggle.checked;

    }





    if (autoToggle) {



        autoRefresh =

            autoToggle.checked;

    }





    if (aiToggle) {



        aiDetection =

            aiToggle.checked;

    }





    /*

     * Save permanently

     */



    saveMonitoringPreferences();





    /*

     * Apply immediately

     */



    updateSettingsUI();



    updateLiveIndicator();



    applyMonitoringState();



    loadAIStatus();





    /*

     * Success message

     */



    window.alert(

        "Security settings saved successfully."

    );





    console.log(

        "[Settings] Saved:",

        getCurrentSettings()

    );

}





/* =========================================================

   RESET SETTINGS

   ========================================================= */



function resetSecuritySettings() {



    const confirmed =

        window.confirm(

            "Reset all security settings to default?"

        );





    if (!confirmed) {



        return;

    }





    /*

     * Restore defaults

     */



    liveMonitoring =

        DEFAULT_SETTINGS.liveMonitoring;



    autoRefresh =

        DEFAULT_SETTINGS.autoRefresh;



    aiDetection =

        DEFAULT_SETTINGS.aiDetection;





    /*

     * Save defaults

     */



    saveMonitoringPreferences();





    /*

     * Update UI

     */



    updateSettingsUI();





    /*

     * Apply immediately

     */



    applyMonitoringState();



    loadAIStatus();





    window.alert(

        "Security settings reset to default."

    );





    console.log(

        "[Settings] Reset:",

        getCurrentSettings()

    );

}





/* =========================================================

   SETTINGS - CROSS TAB SYNC

   ========================================================= */



window.addEventListener(

    "storage",

    event => {



        if (

            event.key !==

            SETTINGS_KEYS.liveMonitoring &&

            event.key !==

            SETTINGS_KEYS.autoRefresh &&

            event.key !==

            SETTINGS_KEYS.aiDetection

        ) {



            return;

        }





        console.log(

            "[Settings] External settings change detected."

        );





        loadSecuritySettings();



        applyMonitoringState();

    }

);



/* =========================================================

   NAVIGATION

   ========================================================= */



function showSection(

    sectionId

) {



    const sections =

        document.querySelectorAll(

            ".section, .page-section"

        );





    sections.forEach(

        section => {



            section.classList.remove(

                "active"

            );

        }

    );





    const section =

        document.getElementById(

            sectionId

        );





    if (section) {



        section.classList.add(

            "active"

        );

    }





    const navItems =

        document.querySelectorAll(

            ".nav-item"

        );





    navItems.forEach(

        item => {



            item.classList.remove(

                "active"

            );





            if (

                item.dataset.section ===

                sectionId

            ) {



                item.classList.add(

                    "active"

                );

            }

        }

    );





    if (

        sectionId === "dashboard" ||

        sectionId === "alerts"

    ) {



        loadDashboard();

    }





    if (

        sectionId === "ai-engine"

    ) {



        loadAIStatus();

    }





    if (

        sectionId === "settings"

    ) {



        loadSecuritySettings();



        loadAIStatus();

    }

}





/* =========================================================

   HTML ESCAPE

   ========================================================= */



function escapeHtml(value) {



    const div =

        document.createElement(

            "div"

        );





    div.textContent =

        value ?? "";





    return div.innerHTML;

}





/* =========================================================

   DATE FORMAT

   ========================================================= */



function formatDate(value) {



    if (!value) {

        return "N/A";

    }





    const date =

        new Date(value);





    if (

        Number.isNaN(

            date.getTime()

        )

    ) {



        return String(value);

    }





    return date.toLocaleString(

        [],

        {

            year: "numeric",

            month: "short",

            day: "2-digit",

            hour: "2-digit",

            minute: "2-digit"

        }

    );

}





/* =========================================================

   DOM CONTENT LOADED

   ========================================================= */



document.addEventListener(

    "DOMContentLoaded",

    () => {



        /* -------------------------------------------------

           Dashboard Search

           ------------------------------------------------- */



        const search =

            document.getElementById(

                "alertSearch"

            );





        if (search) {



            search.addEventListener(

                "input",

                searchAlerts

            );

        }





        /* -------------------------------------------------

           Alerts Page Search

           ------------------------------------------------- */



        const alertsPageSearch =

            document.getElementById(

                "alertsPageSearch"

            );





        if (alertsPageSearch) {



            alertsPageSearch.addEventListener(

                "input",

                searchAlertsPage

            );

        }





        /* -------------------------------------------------

           Navigation

           ------------------------------------------------- */



        const navItems =

            document.querySelectorAll(

                ".nav-item"

            );





        navItems.forEach(

            item => {



                item.addEventListener(

                    "click",

                    event => {



                        event.preventDefault();





                        const section =

                            item.dataset.section;





                        if (section) {



                            showSection(

                                section

                            );

                        }

                    }

                );

            });


        /* -------------------------------------------------
           Dashboard Refresh Button
           ------------------------------------------------- */

        const refreshButton =
            document.getElementById(
                "refreshButton"
            );

        if (refreshButton) {

            refreshButton.addEventListener(
                "click",
                async () => {

                    await refreshDashboard();

                }
            );

        }


        /* -------------------------------------------------
           Settings Buttons
           ------------------------------------------------- */

        const saveSettingsButton =
            document.getElementById(
                "saveSettingsButton"
            );

        if (saveSettingsButton) {

            saveSettingsButton.addEventListener(
                "click",
                () => {

                    saveSecuritySettings();

                }
            );

        }


        const resetSettingsButton =
            document.getElementById(
                "resetSettingsButton"
            );

        if (resetSettingsButton) {

            resetSettingsButton.addEventListener(
                "click",
                () => {

                    resetSecuritySettings();

                }
            );

        }


        /* -------------------------------------------------

           Investigation Modal

           ------------------------------------------------- */



        const modal =

            document.getElementById(

                "investigationModal"

            );





        if (modal) {



            modal.addEventListener(

                "click",

                event => {



                    if (

                        event.target ===

                        modal

                    ) {



                        closeInvestigationModal();

                    }

                }

            );

        }





        /* -------------------------------------------------

           Escape closes modal

           ------------------------------------------------- */



        document.addEventListener(

            "keydown",

            event => {



                if (

                    event.key ===

                    "Escape"

                ) {



                    closeInvestigationModal();

                }

            }

        );





        /* -------------------------------------------------

           Load saved settings FIRST

           ------------------------------------------------- */



        loadSecuritySettings();





        /* -------------------------------------------------

           Initial dashboard

           ------------------------------------------------- */



        showSection(

            "dashboard"

        );





        /* -------------------------------------------------

           Initial AI status

           ------------------------------------------------- */



        loadAIStatus();





        /* -------------------------------------------------

           Auto refresh

           ------------------------------------------------- */



        if (

            liveMonitoring &&

            autoRefresh

        ) {



            startAutoRefresh();

        }





        /* -------------------------------------------------

           WebSocket real-time monitoring

           ------------------------------------------------- */



        if (liveMonitoring) {



            connectWebSocket();



        }



        else {



            updateRealtimeIndicator(

                "paused"

            );

        }





        /* -------------------------------------------------

           Live indicator

           ------------------------------------------------- */



        updateLiveIndicator();



    }

);



