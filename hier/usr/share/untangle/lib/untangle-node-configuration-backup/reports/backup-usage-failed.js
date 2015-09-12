{
    "uniqueId": "configuration-backup-mH7Il2pK",
    "category": "Configuration Backup",
    "description": "The amount of failed configuration backups over time.",
    "displayOrder": 103,
    "enabled": true,
    "javaClass": "com.untangle.node.reports.ReportEntry",
    "orderDesc": false,
    "units": "attempts",
    "readOnly": true,
    "table": "configuration_backup_events",
    "timeDataColumns": [
        "sum(case when success is false then 1 else null end::int) as failed"
    ],
    "colors": [
        "#8c0000"
    ],
    "timeDataInterval": "AUTO",
    "timeStyle": "BAR_3D_OVERLAPPED",
    "title": "Backup Usage (failed)",
    "type": "TIME_GRAPH"
}
