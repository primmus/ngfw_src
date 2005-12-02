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

package com.metavize.tran.openvpn;

import java.io.Serializable;

import com.metavize.mvvm.tran.Validatable;
import com.metavize.mvvm.tran.ValidateException;

public class CertificateParameters implements Serializable, Validatable
{
    // XXX SERIALVER private static final long serialVersionUID = 1032713361795879615L;
    
    private String organization;
    private String domain;
    private String country;
    private String state;
    private String locality;
    private boolean storeCaUsb;

    public CertificateParameters()
    {
        this( "", "", "", "", "", false );
    }

    public CertificateParameters( String organization, String domain, String country, String state, 
                                  String locality, boolean storeCaUsb )
    {
        this.organization = organization;
        this.domain  = domain;
        this.country = country;
        this.state = state;
        this.locality = locality;
        this.storeCaUsb = storeCaUsb;
    }

    public String getOrganization()
    {
        return this.organization;
    }

    public void setOrganization( String organization )
    {
        this.organization = organization;
    }

    public String getDomain()
    {
        return this.domain;
    }

    public void setDomain( String domain )
    {
        this.domain = domain;
    }


    public String getCountry()
    {
        return this.country;
    }

    public void setCountry( String country )
    {
        this.country = country;
    }

    public String getState()
    {
        return this.state;
    }

    public void setState( String state )
    {
        this.state = state;
    }

    public String getLocality()
    {
        return this.locality;
    }

    public void setLocality( String locality )
    {
        this.locality = locality;
    }

    public boolean getStoreCaUsb()
    {
        return this.storeCaUsb;
    }

    public void setStoreCaUsb( boolean storeCaUsb )
    {
        this.storeCaUsb = storeCaUsb;
    }
    
    /** 
     * Validate the object, throw an exception if it is not valid
     */
    public void validate() throws ValidateException
    {
        if ( this.country.length() != 2  && this.country.length() != 0 ) {
            throw new ValidateException( "Country is two characters. " + this.country );
        }
    }
}
