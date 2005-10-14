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
package com.metavize.tran.mail.web.euv.tags;

import javax.servlet.ServletRequest;


/**
 * Outputs the current email address, or null
 * if there 'aint one
 */
public final class CurrentEmailAddressTag
  extends SingleValueTag {

  private static final String ADDRESS_KEY = "metavize.email_address";

  @Override
  protected String getValue() {
    return getCurrent(pageContext.getRequest());
  }  

  public static final void setCurrent(ServletRequest request,
    String address) {
    request.setAttribute(ADDRESS_KEY, address);
  }
  public static final void clearCurret(ServletRequest request) {
    request.removeAttribute(ADDRESS_KEY);
  }

  /**
   * Returns null if there is no current address
   */
  static String getCurrent(ServletRequest request) {
    return (String) request.getAttribute(ADDRESS_KEY);
  }

  static boolean hasCurrent(ServletRequest request) {
    return getCurrent(request) != null;
  }  
}
