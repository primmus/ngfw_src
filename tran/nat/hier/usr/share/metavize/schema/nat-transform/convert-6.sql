-- convert for release 3.1

-------------------------------
-- refer to PipelineEndpoints |
-------------------------------

DROP TABLE events.tr_nat_tmp;

CREATE TABLE events.tr_nat_tmp AS
    SELECT evt.event_id, endp.event_id AS pl_endp_id, rule_id,
           rule_index, is_dmz, evt.time_stamp
    FROM events.tr_nat_redirect_evt evt JOIN pl_endp endp USING (session_id);

DROP TABLE events.tr_nat_redirect_evt;
ALTER TABLE events.tr_nat_tmp RENAME TO tr_nat_redirect_evt;
ALTER TABLE events.tr_nat_redirect_evt ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE events.tr_nat_redirect_evt ADD PRIMARY KEY (event_id);
