import csv
from io import StringIO
from typing import List, Dict, Any

def parse_csv_events(csv_content: str) -> List[Dict[str, Any]]:
    events = []
    f = StringIO(csv_content)
    reader = csv.DictReader(f)
    for row in reader:
        event_type = row.pop("event_type", "unknown")
        events.append({
            "event_type": event_type,
            "payload": row
        })
    return events