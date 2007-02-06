/*
 * Copyright (c) 2007 Untangle, Inc.
 * All rights reserved.
 *
 * This software is the confidential and proprietary information of
 * Untangle, Inc. ("Confidential Information"). You shall
 * not disclose such Confidential Information.
 *
 * $Id: $
 */
package com.untangle.tran.virus;

import java.io.File;

public final class VirusClientContext {
    private InputSettings iSettings;

    private volatile VirusScannerResult virusReport;

    public VirusClientContext(File msgFile, String host, int port) {
        iSettings = new InputSettings(msgFile, host, port);
        virusReport = null;
    }

    public File getMsgFile() {
        return iSettings.getMsgFile();
    }

    public String getHost() {
        return iSettings.getHost();
    }

    public int getPort() {
        return iSettings.getPort();
    }

    public void setResult(boolean clean, String virusName, boolean virusCleaned) {
        if (true == clean) {
            this.virusReport = VirusScannerResult.CLEAN;
        } else {
            this.virusReport = new VirusScannerResult(clean, virusName, virusCleaned);
        }
        return;
    }

    public VirusScannerResult getResult() {
        return virusReport;
    }

    class InputSettings {
        private final File msgFile;
        private final String host;
        private final int port;

        public InputSettings(File msgFile, String host, int port) {
            this.msgFile = msgFile;
            this.host = host;
            this.port = port;
        }

        public File getMsgFile() {
            return msgFile;
        }

        public String getHost() {
            return host;
        }

        public int getPort() {
            return port;
        }
    }
}
