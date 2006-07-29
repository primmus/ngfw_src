/*
 * Copyright (c) 2006 Metavize Inc.
 * All rights reserved.
 *
 * This software is the confidential and proprietary information of
 * Metavize Inc. ("Confidential Information").  You shall
 * not disclose such Confidential Information.
 *
 * $Id: PortalManagerImpl.java 6287 2006-06-23 21:39:49Z amread $
 */

package com.metavize.mvvm.engine;

import java.io.IOException;

import java.security.Principal;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

import javax.servlet.ServletException;

import org.apache.catalina.Valve;
import org.apache.catalina.authenticator.SingleSignOn;
import org.apache.catalina.connector.Request;
import org.apache.catalina.connector.Response;

import com.metavize.mvvm.security.MvvmPrincipal;


class SpecialSingleSignOn extends SingleSignOn
{
    /* This is a set of all of the context paths that use MvvmPrincipal */
    /* Dirty hack designed to ignore sessions that are in this context path */
    private final Set<String> mvvmContextSet;

    SpecialSingleSignOn( String ... contextPathArray )
    {
        Set<String> contextSet = new HashSet<String>();
        
        for ( String contextPath : contextPathArray ) contextSet.add( contextPath );
        
        this.mvvmContextSet =  Collections.unmodifiableSet( contextSet );
        setRequireReauthentication(true);
    }

    /**
     * Perform single-sign-on support processing for this request.
     *
     * @param request The servlet request we are processing
     * @param response The servlet response we are creating
     *
     * @exception IOException if an input/output error occurs
     * @exception ServletException if a servlet error occurs
     */
    @Override
    public void invoke(Request request, Response response)
        throws IOException, ServletException {
        String contextPath = request.getContextPath();
        if ( mvvmContextSet.contains(contextPath)) {
            /* Ignore single sign on for this context path */
            if ( containerLog.isDebugEnabled()) {
                containerLog.debug( "The path: [" + contextPath + "] is ignored by single sign on" );
            }
            
            Valve next = getNext();
            if ( next != null ) next.invoke(request,response);
            return;
        } else {
            if ( containerLog.isDebugEnabled()) {
                containerLog.debug( "The path: [" + contextPath + "] uses sign on" );
            }
        }
        super.invoke( request, response );
    }

    @Override
    protected void register(String ssoId, Principal principal, String authType,
                            String username, String password)
    {
        /* Never register these sessions, they are bunk */
        if (principal instanceof MvvmPrincipal ) {
            if ( containerLog.isDebugEnabled()) {
                containerLog.debug( "Ignoring mvvm principal" );
            }

            return;
        }
        
        super.register(ssoId,principal,authType,username,password);
    }
}
