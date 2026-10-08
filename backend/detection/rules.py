def detect_failed_login(event):
    if (
        event.get("event_type") == "login"
        and event.get("status") == "failed"
    ):
        return {
            "detected": True,
            "rule": "FAILED_LOGIN",
            "severity": "HIGH",
            "risk_score": 80,
            "message": "Failed login attempt detected"
        }

    return {
        "detected": False
    }


def detect_brute_force(event):
    failed_attempts = event.get("failed_attempts", 0)

    if (
        event.get("event_type") == "login"
        and failed_attempts >= 5
    ):
        return {
            "detected": True,
            "rule": "BRUTE_FORCE_LOGIN",
            "severity": "CRITICAL",
            "risk_score": 95,
            "message": "Possible brute-force login attack detected"
        }

    return {
        "detected": False
    }


def detect_privilege_escalation(event):
    if event.get("event_type") == "privilege_escalation":
        return {
            "detected": True,
            "rule": "PRIVILEGE_ESCALATION",
            "severity": "CRITICAL",
            "risk_score": 90,
            "message": "Possible privilege escalation detected"
        }

    return {
        "detected": False
    }


def detect_suspicious_ip(event):
    suspicious_ips = event.get("suspicious_ips", [])

    source_ip = event.get("source_ip")

    if source_ip and source_ip in suspicious_ips:
        return {
            "detected": True,
            "rule": "SUSPICIOUS_IP",
            "severity": "HIGH",
            "risk_score": 85,
            "message": "Connection from suspicious IP detected"
        }

    return {
        "detected": False
    }