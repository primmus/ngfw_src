{
    "uniqueId": "configuration-backup-HF3qFZ9M",
    "category": "Configuration Backup",
    "description": "The amount of successes, and failures of configuration backup over time.",
    "displayOrder": 101,
    "enabled": true,
    "javaClass": "com.untangle.node.reports.ReportEntry",
    "orderDesc": false,
    "units": "attempts",
    "readOnly": true,
    "table": "configuration_backup_events",
    "timeDataColumns": [
        "sum(case when success is true then 1 else null end::int) as passed",
        "sum(case when success is false then 1 else null end::int) as failed"
    ],
    "colors": [
        "#396c2b",
        "#8c0000"
    ],
    "timeDataInterval": "AUTO",
    "timeStyle": "BAR_3D_OVERLAPPED",
    "title": "Backup Usage (all)",
    "type": "TIME_GRAPH"
}
