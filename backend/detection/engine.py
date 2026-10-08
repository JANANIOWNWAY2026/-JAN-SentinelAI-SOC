from detection.rules import (
    detect_failed_login,
    detect_brute_force,
    detect_privilege_escalation,
    detect_suspicious_ip
)


def analyze_event(event):

    detection_rules = [
        detect_brute_force,
        detect_failed_login,
        detect_privilege_escalation,
        detect_suspicious_ip
    ]

    for rule in detection_rules:

        result = rule(event)

        if result.get("detected"):
            return result

    return {
        "detected": False,
        "rule": "NO_THREAT",
        "severity": "LOW",
        "risk_score": 0,
        "message": "No suspicious activity detected"
    }