{
    "uniqueId": "virus-blocker-lite-IyG8eOrn",
    "category": "Virus Blocker Lite",
    "description": "The number of blocked viruses by web activity.",
    "displayOrder": 104,
    "enabled": true,
    "javaClass": "com.untangle.node.reporting.ReportEntry",
    "orderByColumn": "value",
    "orderDesc": true,
    "units": "hits",
    "pieGroupColumn": "virus_blocker_lite_name",
    "pieSumColumn": "count(*)",
    "conditions": [
        {
            "column": "virus_blocker_lite_clean",
            "javaClass": "com.untangle.node.reporting.SqlCondition",
            "operator": "=",
            "value": "false"
        }
    ],
    "readOnly": true,
    "table": "http_events",
    "title": "Web Top Blocked Viruses",
    "type": "PIE_GRAPH"
}