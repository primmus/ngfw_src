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

package com.metavize.tran.mail.impl.smtp;

import static com.metavize.tran.util.Ascii.*;
import static com.metavize.tran.util.BufferUtil.*;

import com.metavize.mvvm.*;
import com.metavize.mvvm.tapi.*;
import com.metavize.tran.mail.papi.smtp.*;
import com.metavize.tran.token.*;
import com.metavize.tran.util.*;
import org.apache.log4j.Logger;

public class SmtpClientUnparser
  extends AbstractUnparser {

  private final Logger m_logger = Logger.getLogger(SmtpClientUnparser.class);

  private final SmtpCasing m_parentCasing;

  public SmtpClientUnparser(TCPSession session,
    SmtpCasing parent) {
    super(session, true);
    m_logger.debug("Created");
    m_parentCasing = parent;
  }


  public UnparseResult unparse(Token token)
    throws UnparseException {
    m_logger.debug("Token of class " + token.getClass().getName());
    if(token instanceof MetadataToken) {
      //Don't pass along metadata tokens
      return UnparseResult.NONE;
    }
    if(token instanceof Response) {
      Response resp = (Response) token;
      m_logger.debug("Unparsing response with code " +
        resp.getCode() + " and " + resp.getArgs().length + " lines");
    }

    m_parentCasing.traceUnparse(token.getBytes());
    return new UnparseResult(token.getBytes());
  }

  public TokenStreamer endSession() {
    m_logger.debug("End Session");
    m_parentCasing.endSession(false);
    return null;
  }
}
