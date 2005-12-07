-- schema for release-3.1

-------------
-- settings |
-------------

-- com.metavize.tran.airgap.AirgapSettings
CREATE TABLE settings.tr_airgap_settings (
    settings_id int8 NOT NULL,
    tid         int8 NOT NULL UNIQUE,
    PRIMARY KEY (settings_id));

CREATE TABLE settings.tr_airgap_shield_node_rule (
    rule_id     INT8 NOT NULL,
    name        text,
    category    text,
    description text,
    live        BOOL NOT NULL,
    alert       BOOL NOT NULL,
    log         BOOL NOT NULL,
    address     INET,
    netmask     INET,
    divider     REAL NOT NULL,
    settings_id INT8 NOT NULL,
    position    INT4 NOT NULL,
    PRIMARY KEY (rule_id));

----------------
-- constraints |
----------------

-- foreign key constraints

ALTER TABLE settings.tr_airgap_settings
    ADD CONSTRAINT fk_tr_airgap_settings FOREIGN KEY (tid) REFERENCES tid;

ALTER TABLE settings.tr_airgap_shield_node_rule
    ADD CONSTRAINT fk_tr_airgap_shield_node_rule
        FOREIGN KEY (settings_id) REFERENCES settings.tr_airgap_settings;
