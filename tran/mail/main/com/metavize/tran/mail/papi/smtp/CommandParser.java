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

package com.metavize.tran.mail.papi.smtp;

import static com.metavize.tran.util.Rfc822Util.*;
import static com.metavize.tran.util.Ascii.*;

import java.nio.ByteBuffer;

import com.metavize.tran.token.ParseException;
import com.metavize.tran.token.Token;

/**
 * Because of classloader issues this class is public.  However,
 * it should really not be used other than in the casing.
 */
public class CommandParser {

  /**
   * Parse the buffer (which must have a complete line!)
   * into a Command.  May return a subclass
   * of Command for Commands with interesting arguments
   * we wish parsed.
   */
  public static Command parse(ByteBuffer buf)
    throws ParseException {

    //TODO bscott Shouldn't the command token always
    //     be 4 in length?  Should we make this some type
    //     of guard against evildooers?
    String cmdStr = consumeToken(buf);
    cmdStr=cmdStr==null?
      "":cmdStr.trim();
    eatSpace(buf);
    String argStr = consumeLine(buf);
    Command.CommandType type = Command.stringToCommandType(cmdStr);

    switch(type) {
      case MAIL:
        return new MAILCommand(cmdStr, argStr);
      case RCPT:
        return new RCPTCommand(cmdStr, argStr);
      default:
        return new Command(type, cmdStr, argStr);    
    }
  }

  public static void main(String[] args) throws Exception {
    String crlf = "\r\n";

    System.out.println(parse(ByteBuffer.wrap(("\r" + crlf).getBytes())).getCmdString());
    
    System.out.println(parse(ByteBuffer.wrap(("FOO" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap(("" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap(("\t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" \t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap(("\t " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" \t " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap(("FOO " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap(("FOO  " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap(("FOO\t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap(("FOO \t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap(("FOO\t " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap(("FOO \t " + crlf).getBytes())).getCmdString());

    System.out.println(parse(ByteBuffer.wrap((" FOO" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO  " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO\t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO \t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO\t " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO \t " + crlf).getBytes())).getCmdString());

    System.out.println(parse(ByteBuffer.wrap((" FOO x" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO  x" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO\tx" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO \tx" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO\t x" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO \t x" + crlf).getBytes())).getCmdString());

    System.out.println(parse(ByteBuffer.wrap((" FOO x " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO x  " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO x\t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO x \t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO x\t " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO x \t " + crlf).getBytes())).getCmdString());

    System.out.println(parse(ByteBuffer.wrap((" FOO  x " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO  x  " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO  x\t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO  x \t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO  x\t " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO  x \t " + crlf).getBytes())).getCmdString());

    System.out.println(parse(ByteBuffer.wrap((" FOO\tx " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO\tx  " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO\tx\t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO\tx \t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO\tx\t " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO\tx \t " + crlf).getBytes())).getCmdString());

    System.out.println(parse(ByteBuffer.wrap((" FOO \tx " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO \tx  " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO \tx\t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO \tx \t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO \tx\t " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO \tx \t " + crlf).getBytes())).getCmdString());

    System.out.println(parse(ByteBuffer.wrap((" FOO \tx " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO \tx  " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO \tx\t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO \tx\t " + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO \tx \t" + crlf).getBytes())).getCmdString());
    System.out.println(parse(ByteBuffer.wrap((" FOO \tx \t " + crlf).getBytes())).getCmdString());

  }
  
}