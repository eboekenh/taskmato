// Cancels a previously scheduled (not-yet-delivered) OneSignal notification -
// used when the user hits Reset before a session naturally finishes, so they
// don't get a stale "session over" push for a session they abandoned.
//
// Requires the same environment variables as schedule-notification.js:
//   ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY } = process.env;
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY are not configured on the server.' })
        };
    }

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
    }

    const { notificationId } = payload;
    if (!notificationId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'notificationId is required.' }) };
    }

    try {
        const url = `https://api.onesignal.com/notifications/${notificationId}?app_id=${ONESIGNAL_APP_ID}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'Authorization': `Key ${ONESIGNAL_REST_API_KEY}` }
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { statusCode: response.status, body: JSON.stringify({ error: result }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
    }
};
