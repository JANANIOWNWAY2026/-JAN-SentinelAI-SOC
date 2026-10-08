from sklearn.ensemble import IsolationForest


# Training data
# [failed_attempts, login_hour, unique_ips]

training_data = [
    [0, 9, 1],
    [1, 10, 1],
    [0, 11, 1],
    [1, 14, 1],
    [0, 15, 1],
    [1, 16, 1],
    [0, 18, 1],
    [2, 10, 1],
    [1, 12, 1],
    [0, 13, 1],
    [2, 15, 1],
    [1, 17, 1]
]


# Create AI model
model = IsolationForest(
    contamination=0.15,
    random_state=42
)


# Train the model
model.fit(training_data)


# AI anomaly detection function
def detect_anomaly(event):

    failed_attempts = event.get("failed_attempts", 0)
    login_hour = event.get("login_hour", 12)
    unique_ips = event.get("unique_ips", 1)

    features = [[
        failed_attempts,
        login_hour,
        unique_ips
    ]]

    # Predict anomaly
    prediction = model.predict(features)

    # Calculate anomaly score
    anomaly_score = model.decision_function(features)[0]

    # If AI detects anomaly
    if prediction[0] == -1:

        return {
            "anomaly_detected": True,
            "anomaly_score": round(float(anomaly_score), 4),
            "message": "AI model detected unusual activity"
        }

    # If activity is normal
    return {
        "anomaly_detected": False,
        "anomaly_score": round(float(anomaly_score), 4),
        "message": "AI model detected normal activity"
    }