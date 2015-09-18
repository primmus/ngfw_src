{
    "uniqueId": "bandwidth-control-MjamPpPHU9",
    "category": "Bandwidth Control",
    "description": "The sum of the sent data grouped by hostname.",
    "displayOrder": 203,
    "enabled": true,
    "javaClass": "com.untangle.node.reports.ReportEntry",
    "orderByColumn": "value",
    "orderDesc": true,
    "units": "MB",
    "pieGroupColumn": "hostname",
    "pieSumColumn": "round(coalesce(sum(p2s_bytes), 0) / (1024*1024),1)",
    "readOnly": true,
    "table": "sessions",
    "title": "Top Hostnames (by sent bytes)",
    "type": "PIE_GRAPH"
}
