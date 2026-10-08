from fastapi import (
    FastAPI,
    HTTPException,
    WebSocket,
    WebSocketDisconnect
)

from pydantic import BaseModel

from database import engine
from models import Alert

from elasticsearch import Elasticsearch

from detection.engine import analyze_event

from sqlalchemy import select, func

from ai_engine import detect_anomaly

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from pathlib import Path


# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(title="SentinelAI")


# =========================================================
# FRONTEND CONFIGURATION
# =========================================================

FRONTEND_DIR = (
    Path(__file__).resolve().parent.parent / "frontend"
)


app.mount(
    "/assets",
    StaticFiles(directory=FRONTEND_DIR),
    name="assets"
)


# =========================================================
# ELASTICSEARCH
# =========================================================

es = Elasticsearch(
    "http://localhost:9200"
)


# =========================================================
# WEBSOCKET CONNECTION MANAGER
# =========================================================

class ConnectionManager:

    def __init__(self):

        self.active_connections = []


    async def connect(
        self,
        websocket: WebSocket
    ):

        await websocket.accept()

        self.active_connections.append(
            websocket
        )

        print(
            f"[WebSocket] Client connected. "
            f"Active clients: {len(self.active_connections)}"
        )


    def disconnect(
        self,
        websocket: WebSocket
    ):

        if websocket in self.active_connections:

            self.active_connections.remove(
                websocket
            )

        print(
            f"[WebSocket] Client disconnected. "
            f"Active clients: {len(self.active_connections)}"
        )


    async def broadcast(
        self,
        message: dict
    ):

        disconnected = []


        for websocket in self.active_connections:

            try:

                await websocket.send_json(
                    message
                )

            except Exception:

                disconnected.append(
                    websocket
                )


        for websocket in disconnected:

            self.disconnect(
                websocket
            )


manager = ConnectionManager()


# =========================================================
# REQUEST MODELS
# =========================================================

class AlertCreate(BaseModel):

    title: str
    severity: str


class StatusUpdate(BaseModel):

    status: str


# =========================================================
# FRONTEND
# =========================================================

@app.get(
    "/",
    include_in_schema=False
)
def frontend():

    return FileResponse(
        str(
            FRONTEND_DIR / "index.html"
        )
    )


# =========================================================
# WEBSOCKET - REAL TIME SOC MONITORING
# =========================================================

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket
):

    await manager.connect(
        websocket
    )

    try:

        await websocket.send_json({

            "event": "connected",

            "service": "SentinelAI",

            "message":
                "Real-time monitoring connected"

        })


        while True:

            await websocket.receive_text()


    except WebSocketDisconnect:

        manager.disconnect(
            websocket
        )


    except Exception:

        manager.disconnect(
            websocket
        )


# =========================================================
# DATABASE TEST
# =========================================================

@app.get("/db-test")
def database_test():

    with engine.connect() as connection:

        return {

            "message":
                "SentinelAI connected to PostgreSQL successfully",

            "database":
                "sentinelai"
        }


# =========================================================
# AI STATUS
# =========================================================

@app.get("/ai-status")
def ai_status():

    with engine.connect() as connection:

        total_analyzed = connection.execute(

            select(func.count())
            .select_from(Alert)
            .where(
                Alert.ai_anomaly.is_not(None)
            )

        ).scalar()


        anomalies_detected = connection.execute(

            select(func.count())
            .select_from(Alert)
            .where(
                Alert.ai_anomaly == True
            )

        ).scalar()


        latest_score = connection.execute(

            select(
                Alert.ai_anomaly_score
            )
            .where(
                Alert.ai_anomaly_score.is_not(None)
            )
            .order_by(
                Alert.id.desc()
            )
            .limit(1)

        ).scalar()


    return {

        "model":
            "Isolation Forest",

        "status":
            "ONLINE",

        "anomaly_detection":
            "ENABLED",

        "total_analyzed":
            total_analyzed or 0,

        "anomalies_detected":
            anomalies_detected or 0,

        "latest_anomaly_score":
            latest_score
    }


# =========================================================
# CREATE ALERT
# =========================================================

@app.post("/alerts")
async def create_alert(
    alert: AlertCreate
):

    with engine.begin() as connection:

        result = connection.execute(

            Alert.__table__.insert().values(

                title=alert.title,

                severity=alert.severity,

                status="NEW"

            )
        )


        alert_id = result.inserted_primary_key[0]


    # -----------------------------------------------------
    # SEND ALERT TO ELASTICSEARCH
    # -----------------------------------------------------

    es.index(

        index="alerts",

        document={

            "alert_id":
                alert_id,

            "title":
                alert.title,

            "severity":
                alert.severity,

            "status":
                "NEW"
        }
    )


    # -----------------------------------------------------
    # REAL-TIME WEBSOCKET EVENT
    # -----------------------------------------------------

    await manager.broadcast({

        "event":
            "alert_created",

        "alert_id":
            alert_id,

        "title":
            alert.title,

        "severity":
            alert.severity,

        "status":
            "NEW"
    })


    return {

        "message":
            "Alert created successfully",

        "alert_id":
            alert_id,

        "title":
            alert.title,

        "severity":
            alert.severity,

        "status":
            "NEW"
    }


# =========================================================
# SECURITY EVENT ANALYSIS
# RULE ENGINE + AI ENGINE
# =========================================================

@app.post("/analyze")
async def analyze_security_event(
    event: dict
):

    # -----------------------------------------------------
    # RULE-BASED DETECTION
    # -----------------------------------------------------

    rule_result = analyze_event(event)


    # -----------------------------------------------------
    # AI ANOMALY DETECTION
    # -----------------------------------------------------

    ai_result = detect_anomaly(event)


    # -----------------------------------------------------
    # DETECTION RESULTS
    # -----------------------------------------------------

    threat_detected = rule_result.get(
        "detected",
        False
    )


    anomaly_detected = ai_result.get(
        "anomaly_detected",
        False
    )


    # -----------------------------------------------------
    # IF THREAT DETECTED
    # -----------------------------------------------------

    if threat_detected or anomaly_detected:

        # -------------------------------------------------
        # RULE ENGINE DETECTED THREAT
        # -------------------------------------------------

        if threat_detected:

            title = rule_result["message"]

            severity = rule_result["severity"]

            rule = rule_result.get(
                "rule"
            )

            risk_score = rule_result.get(
                "risk_score",
                0
            )


        # -------------------------------------------------
        # ONLY AI DETECTED ANOMALY
        # -------------------------------------------------

        else:

            title = ai_result["message"]

            severity = "MEDIUM"

            rule = "AI_ANOMALY"

            risk_score = 70


        # -------------------------------------------------
        # SAVE ALERT TO POSTGRESQL
        # -------------------------------------------------

        with engine.begin() as connection:

            db_result = connection.execute(

                Alert.__table__.insert().values(

                    title=title,

                    severity=severity,

                    rule=rule,

                    risk_score=risk_score,

                    status="NEW",

                    source_ip=event.get(
                        "source_ip"
                    ),

                    username=event.get(
                        "username"
                    ),

                    ai_anomaly=anomaly_detected,

                    ai_anomaly_score=ai_result.get(
                        "anomaly_score"
                    )
                )
            )


            alert_id = (
                db_result.inserted_primary_key[0]
            )


        # -------------------------------------------------
        # SAVE ALERT TO ELASTICSEARCH
        # -------------------------------------------------

        es.index(

            index="alerts",

            document={

                "alert_id":
                    alert_id,

                "title":
                    title,

                "severity":
                    severity,

                "rule":
                    rule,

                "risk_score":
                    risk_score,

                "status":
                    "NEW",

                "source_ip":
                    event.get(
                        "source_ip"
                    ),

                "username":
                    event.get(
                        "username"
                    ),

                "ai_anomaly":
                    anomaly_detected,

                "ai_anomaly_score":
                    ai_result.get(
                        "anomaly_score"
                    ),

                "event":
                    event
            }
        )


        # -------------------------------------------------
        # REAL-TIME SOC BROADCAST
        # -------------------------------------------------

        await manager.broadcast({

            "event":
                "security_alert",

            "alert_id":
                alert_id,

            "title":
                title,

            "severity":
                severity,

            "rule":
                rule,

            "risk_score":
                risk_score,

            "status":
                "NEW",

            "source_ip":
                event.get(
                    "source_ip"
                ),

            "username":
                event.get(
                    "username"
                ),

            "ai_anomaly":
                anomaly_detected,

            "ai_anomaly_score":
                ai_result.get(
                    "anomaly_score"
                )
        })


        # -------------------------------------------------
        # RESPONSE
        # -------------------------------------------------

        return {

            "message":
                "Security threat detected",

            "alert_id":
                alert_id,

            "event":
                event,

            "rule_analysis":
                rule_result,

            "ai_analysis":
                ai_result
        }


    # =====================================================
    # NO THREAT DETECTED
    # =====================================================

    return {

        "message":
            "No security threat detected",

        "event":
            event,

        "rule_analysis":
            rule_result,

        "ai_analysis":
            ai_result
    }


# =========================================================
# GET ALL ALERTS
# =========================================================

@app.get("/alerts")
def get_alerts():

    with engine.connect() as connection:

        result = connection.execute(

            select(Alert)
            .order_by(
                Alert.id.desc()
            )
        )


        alerts = result.mappings().all()


    return {

        "count":
            len(alerts),

        "alerts": [

            dict(alert)

            for alert in alerts
        ]
    }


# =========================================================
# GET SINGLE ALERT
# =========================================================

@app.get("/alerts/{alert_id}")
def get_alert(
    alert_id: int
):

    with engine.connect() as connection:

        result = connection.execute(

            select(Alert)
            .where(
                Alert.id == alert_id
            )
        )


        alert = result.mappings().first()


    if not alert:

        raise HTTPException(

            status_code=404,

            detail="Alert not found"
        )


    return dict(alert)


# =========================================================
# UPDATE ALERT STATUS
# =========================================================

@app.patch("/alerts/{alert_id}/status")
async def update_alert_status(

    alert_id: int,

    status_update: StatusUpdate
):

    # -----------------------------------------------------
    # ALLOWED STATUSES
    # -----------------------------------------------------

    allowed_statuses = [

        "NEW",

        "INVESTIGATING",

        "RESOLVED"

    ]


    # -----------------------------------------------------
    # VALIDATE STATUS
    # -----------------------------------------------------

    if status_update.status not in allowed_statuses:

        raise HTTPException(

            status_code=400,

            detail="Invalid status"
        )


    # -----------------------------------------------------
    # UPDATE DATABASE
    # -----------------------------------------------------

    with engine.begin() as connection:

        result = connection.execute(

            Alert.__table__
            .update()
            .where(
                Alert.id == alert_id
            )
            .values(
                status=status_update.status
            )
        )


        # -------------------------------------------------
        # ALERT NOT FOUND
        # -------------------------------------------------

        if result.rowcount == 0:

            raise HTTPException(

                status_code=404,

                detail="Alert not found"
            )


    # -----------------------------------------------------
    # UPDATE ELASTICSEARCH
    # -----------------------------------------------------

    try:

        es.update_by_query(

            index="alerts",

            query={

                "term": {

                    "alert_id":
                        alert_id

                }

            },

            script={

                "source":
                    "ctx._source.status = params.status",

                "params": {

                    "status":
                        status_update.status

                }

            }

        )

    except Exception:

        pass


    # -----------------------------------------------------
    # REAL-TIME STATUS UPDATE
    # -----------------------------------------------------

    await manager.broadcast({

        "event":
            "alert_status_updated",

        "alert_id":
            alert_id,

        "status":
            status_update.status
    })


    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {

        "message":
            "Alert status updated successfully",

        "alert_id":
            alert_id,

        "status":
            status_update.status
    }