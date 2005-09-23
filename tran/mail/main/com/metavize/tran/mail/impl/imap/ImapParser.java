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

package com.metavize.tran.mail.impl.imap;

import java.nio.ByteBuffer;
import com.metavize.mvvm.tapi.TCPSession;
import com.metavize.tran.token.TokenStreamer;
import org.apache.log4j.Logger;
import com.metavize.tran.mail.impl.AbstractMailParser;


/**
 * Base class for the ImapClient/ServerParser
 */
abstract class ImapParser
  extends AbstractMailParser {

  private final Logger m_logger = Logger.getLogger(ImapParser.class);

  ImapParser(TCPSession session,
    ImapCasing parent,
    boolean clientSide) {

    super(session, parent, clientSide, "imap");
  }

  /**
   * Accessor for the parent casing
   */
  protected ImapCasing getImapCasing() {
    return (ImapCasing) getParentCasing();
  }

  /**
   * Helper which compacts (and possibly expands)
   * the buffer if anything remains.  Otherwise,
   * just returns null.
   */
  protected static ByteBuffer compactIfNotEmpty(ByteBuffer buf,
    int maxTokenSz) {
    if(buf.hasRemaining()) {
      //Note - do not compact, copy instead.  There was an issue
      //w/ the original buffer being passed as tokens (and we were modifying
      //the head).
      ByteBuffer ret = ByteBuffer.allocate(maxTokenSz+1024);
      ret.put(buf);
      return ret;

    }
    else {
      return null;
    }
  }
  
} 