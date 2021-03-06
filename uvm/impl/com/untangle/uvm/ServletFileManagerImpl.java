/**
 * $Id$
 */
package com.untangle.uvm;

import java.util.HashMap;
import java.util.Map;
import java.util.Collections;

import com.untangle.uvm.servlet.DownloadHandler;
import com.untangle.uvm.servlet.UploadHandler;
import com.untangle.uvm.servlet.ServletFileManager;

/**
 * Managers upload/download of files
 *
 * upload/download of files from the UI/admin interface requires a servlet.
 * Instead of having a custom separate servlet to handle the upload/download of files for each use case
 * There is a global "upload" servlet and a global "download" servlet.
 *
 * To use this the party interested in receiving uploads or serving downloads must register a handler
 * of a certain type (string). The UI will specify this type when performing the upload or download request
 * and the handler is called to either handle the upload or provide the file for download.
 */
public class ServletFileManagerImpl implements ServletFileManager
{
    Map<String,UploadHandler> uploadHandlers = new HashMap<String,UploadHandler>();
    Map<String,DownloadHandler> downloadHandlers = new HashMap<String,DownloadHandler>();
    
    @Override
    public UploadHandler getUploadHandler(String name)
    {
        return this.uploadHandlers.get(name);
    }

    @Override
    public Map<String,UploadHandler> getUploadHandlers()
    {
        return Collections.unmodifiableMap(this.uploadHandlers);
    }

    @Override
    public void registerUploadHandler(UploadHandler handler)
    {
        this.uploadHandlers.put(handler.getName(), handler);
    }

    @Override
    public void unregisterUploadHandler(String name)
    {
        this.uploadHandlers.remove(name);
    }

    @Override
    public DownloadHandler getDownloadHandler(String name)
    {
        return this.downloadHandlers.get(name);
    }

    @Override
    public Map<String,DownloadHandler> getDownloadHandlers()
    {
        return Collections.unmodifiableMap(this.downloadHandlers);
    }

    @Override
    public void registerDownloadHandler(DownloadHandler handler)
    {
        this.downloadHandlers.put(handler.getName(), handler);
    }

    @Override
    public void unregisterDownloadHandler(String name)
    {
        this.uploadHandlers.remove(name);
    }
    
}
