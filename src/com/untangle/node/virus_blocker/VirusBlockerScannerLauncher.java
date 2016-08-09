/*
 * $Id: VirusBlockerScannerLauncher.java 37269 2014-02-26 23:46:16Z dmorris $
 */

package com.untangle.node.virus_blocker;

import java.lang.StringBuilder;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.Serializable;
import java.io.File;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;

import org.json.JSONObject;
import org.json.JSONString;

import com.untangle.uvm.vnet.NodeSession;

public class VirusBlockerScannerLauncher extends VirusScannerLauncher
{
    private static final long CLOUD_SCAN_MAX_MILLISECONDS = 2000;
    private static final String BDAM_SCANNER_HOST = "127.0.0.1";
    private static final int BDAM_SCANNER_PORT = 1344;

    /**
     * Create a Launcher for the give file
     */
    public VirusBlockerScannerLauncher(File scanfile, NodeSession session)
    {
        super(scanfile, session);
    }

    /**
     * This runs the virus scan, and stores the result for retrieval. Any
     * threads in waitFor() are awoken so they can retrieve the result
     */
    public void run()
    {
        File scanFile = new File(scanfilePath);
        long scanFileLength = scanFile.length();
        VirusCloudScanner cloudScanner = null;
        VirusCloudResult cloudResult = null;
        String daemonResult = null;
        String virusName = null;

        VirusBlockerState virusState = (VirusBlockerState) nodeSession.attachment();

        logger.debug("Scanning file: " + scanfilePath + " MD5: " + virusState.fileHash);

        // if we have a good MD5 hash then spin up the cloud checker
        if (virusState.fileHash != null) {
            cloudScanner = new VirusCloudScanner(virusState);
            cloudScanner.start();
        }

        File daemonCheck = new File("/etc/init.d/untangle-bdamserver");

        // if the bdamserver package is installed have it scan the file        
        if (daemonCheck.exists()) {
            DataOutputStream txstream = null;
            DataInputStream rxstream = null;
            Socket socket = null;
            byte buffer[] = new byte[256];
            long timeSeconds = 0;
            int txcount = 0;
            int rxcount = 0;

            // Transmit the scan request to the daemon and grab the response
            // Syntax = SCANFILE options filename - available options bits: (see docs for details)
            // 1 = BDAM_SCANOPT_ARCHIVES
            // 2 = BDAM_SCANOPT_PACKED
            // 4 = BDAM_SCANOPT_EMAILS
            // 8 = enable virus heuristics scanner
            // 16 = BDAM_SCANOPT_DISINFECT
            // 32 = return in-progress information
            // 64 = BDAM_SCANOPT_SPAMCHECK
            try {
                InetSocketAddress address = new InetSocketAddress(BDAM_SCANNER_HOST, BDAM_SCANNER_PORT);
                socket = new Socket();
                socket.connect(address, 10000);
                socket.setSoTimeout(10000);
                txstream = new DataOutputStream(socket.getOutputStream());
                rxstream = new DataInputStream(socket.getInputStream());
                txstream.writeBytes("SCANFILE 15 " + scanfilePath + "\r\n");
                txcount = txstream.size();
                rxcount = rxstream.read(buffer);
            } catch (Exception exn) {
                // instead of bailing out on exceptions we craft an error result
                // and continue so we can get the result from the cloud scanner
                logger.warn("Exception scanning file: " + exn.getMessage());
                String errorText = ("221 E " + exn.getClass().getName());
                buffer = errorText.getBytes();
                rxcount = errorText.length();
            }

            // close the streams and socket ignoring exceptions
            try {
                if (txstream != null) txstream.close();
                if (rxstream != null) rxstream.close();
                if (socket != null) socket.close();
            } catch (Exception exn) {
            }

            // REPLY EXAMPLE: 222 V Trojan.GenericKD.1359402
            // REPLY FORMAT: ccc ttt nnn
            // ccc = result code
            // ttt = malware type (Virus, Spyware, adWare, Dialer, App)
            // nnn = malware name

            daemonResult = new String(buffer, 0, rxcount).trim();
        }
        // the bdamserver is not available so dummy up fake clean result
        else {
            daemonResult = "227 U Scanner.Not.Installed";
        }

        logger.debug("Scan result: " + daemonResult);

        // split the string on the spaces so we can find all the fields
        String[] tokens = daemonResult.split(" ");
        int retcode = 0;
        String threatName = null;
        String threatType = null;

        try {
            retcode = Integer.valueOf(tokens[0]);
        } catch (Exception exn) {
            logger.warn("Exception parsing result code: " + daemonResult, exn);
        }

        try {
            threatType = tokens[1];
            threatName = tokens[2];
        } catch (Exception e) {
            // ignore exception, there aren't always 3 tokens
        }

        if (cloudScanner != null) {
            try {
                synchronized (cloudScanner) {
                    cloudScanner.wait(CLOUD_SCAN_MAX_MILLISECONDS);
                }
            } catch (Exception exn) {
                logger.debug("Exception waiting for CloudScanner: ", exn);
            }
            cloudResult = cloudScanner.getCloudResult();
        }

        VirusCloudFeedback feedback = null;

        // if BD returned positive result we send the feedback
        if ((retcode == 222) || (retcode == 223)) {
            feedback = new VirusCloudFeedback(virusState, "BD", threatName, threatType, scanFileLength, nodeSession, cloudResult);
        }

        // if no BD feedback and cloud returned positive result we also send feedback
        if ((feedback == null) && (cloudResult != null) && (cloudResult.getItemCategory() != null) && (cloudResult.getItemConfidence() == 100)) {
            feedback = new VirusCloudFeedback(virusState, "BD", threatName, threatType, scanFileLength, nodeSession, cloudResult);
        }

        // if we have a feedback object start it up now
        if (feedback != null) feedback.start();

        // if the cloud says it is infected we set the result and return now
        if ((cloudResult != null) && (cloudResult.getItemCategory() != null) && (cloudResult.getItemConfidence() == 100)) {
            setResult(new VirusScannerResult(false, cloudResult.getItemCategory()));
            return;
        }

        // no action on the cloud feedback so we use whatever BD gave us
        switch (retcode)
        {
        case 227: // clean
            setResult(VirusScannerResult.CLEAN);
            break;
        case 222: // known infection
            setResult(new VirusScannerResult(false, threatName));
            break;
        case 223: // likely infection
            setResult(new VirusScannerResult(false, threatName));
            break;
        case 225: // password protected file
            setResult(VirusScannerResult.CLEAN);
            break;
        case 221: // scan aborted or failed
            setResult(VirusScannerResult.ERROR);
            break;
        case 224: // corrupted file
            setResult(VirusScannerResult.ERROR);
            break;
        default:
            setResult(VirusScannerResult.ERROR);
            break;
        }
        return;
    }

    private void setResult(VirusScannerResult value)
    {
        this.result = value;

        synchronized (this) {
            this.notifyAll();
        }
    }
}
