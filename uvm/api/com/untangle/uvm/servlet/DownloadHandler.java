/**
 * $Id$
 */
package com.untangle.uvm.servlet;

import java.io.File;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public interface DownloadHandler
{
    public String getName();
    
    public void serveDownload( HttpServletRequest req, HttpServletResponse resp );
}
