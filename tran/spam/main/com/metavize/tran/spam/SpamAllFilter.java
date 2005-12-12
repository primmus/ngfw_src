/*
 * Copyright (c) 2005 Metavize Inc.
 * All rights reserved.
 *
 * This software is the confidential and proprietary information of
 * Metavize Inc. ("Confidential Information").  You shall
 * not disclose such Confidential Information.
 *
 * $Id$
 */

package com.metavize.tran.spam;

import com.metavize.mvvm.logging.RepositoryDesc;
import com.metavize.mvvm.logging.SimpleEventFilter;

public class SpamAllFilter implements SimpleEventFilter<SpamEvent>
{
    private static final RepositoryDesc REPO_DESC = new RepositoryDesc("All Events");

    private static final String LOG_QUERY
        = "FROM SpamLogEvent evt WHERE evt.messageInfo.pipelineEndpoints.policy = :policy ORDER BY evt.timeStamp DESC";
    private static final String SMTP_QUERY
        = "FROM SpamSmtpEvent evt WHERE evt.messageInfo.pipelineEndpoints.policy = :policy ORDER BY evt.timeStamp DESC";

    // SimpleEventFilter methods ----------------------------------------------

    public RepositoryDesc getRepositoryDesc()
    {
        return REPO_DESC;
    }

    public String[] getQueries()
    {
        return new String[] { LOG_QUERY, SMTP_QUERY };
    }

    public boolean accept(SpamEvent e)
    {
        return true;
    }
}
