/**
 * $Id$
 */
#ifndef __DEBUG_H
#define __DEBUG_H

#define DEBUG_MAX_PKGS 256

#define UTIL_DEBUG_PKG 255

#ifdef DEBUG_ON
#include <stdio.h>

extern int  _debug_init(void);

#ifndef DEBUG_PKG
#error You need to define DEBUG_PKG (to an integer <255) to use debug
#endif

/**
 * usage: like printf except the first argument is the debug level 
 * lower debug level should be more important 
 * example: debug(3,"number: %i \n",n) 
 * if level is less than __DEBUG_LEVEL then it will be printed 
 */
extern int  _debug(int pkg,int level,char *lpszFmt, ...) __attribute__ ((format (printf, 3, 4)));

/**
 * usage: like printf except the first argument is the debug level 
 * lower debug level should be more important 
 * example: debug(3,"number: %i \n",n) 
 * if level is less than __DEBUG_LEVEL then it will be printed 
 * This prints a backtrace at the end
 */
extern int  _debug_backtrace(int pkg,int level,char *lpszFmt, ...) __attribute__ ((format (printf, 3, 4)));

/**
 * same as debug but with no date prefix
 */
extern int  _debug_nodate(int pkg,int level,char *lpszFmt, ...) __attribute__ ((format (printf, 3, 4)));

/**
 * changes the output debug (defaults to stdout)
 */
extern void _debug_set_output(int pkg,FILE * out);

/**
 * set the debug level - only things with a debug level 
 * less than this level are printed(inclusive)
 */
extern void _debug_set_level(int pkg,int lev);

/**
 * gets the current debug level
 */
extern int _debug_get_level( int pkg );

/**
 * turns the date prefix on/off 
 */
extern void _debug_date_toggle(int pkg,int onoff);


#define debug(...)             _debug(DEBUG_PKG,__VA_ARGS__)
#define debug_nodate(...)      _debug_nodate(DEBUG_PKG,__VA_ARGS__)
#define debug_set_myoutput(a)  _debug_set_output(DEBUG_PKG,a)
#define debug_set_output(...)  _debug_set_output(__VA_ARGS__)
#define debug_set_mylevel(a)   _debug_set_level(DEBUG_PKG,a)
#define debug_get_mylevel()    _debug_get_level(DEBUG_PKG)
#define debug_backtrace(...)   _debug_backtrace(DEBUG_PKG,__VA_ARGS__)

#define debug_set_level(...)   _debug_set_level(__VA_ARGS__)
#define debug_date_toggle(a)   _debug_date_toggle(DEBUG_PKG)

#else /*DEBUG_ON*/

#define debug(...)             (void)0
#define debug_nodate(...)      (void)0
#define debug_set_myoutput(a)  (void)0
#define debug_set_output(...)  (void)0
#define debug_set_mylevel(a)   (void)0
#define debug_get_mylevel()    -1
#define debug_set_level(...)   (void)0
#define debug_date_toggle(a)   (void)0
#define debug_backtrace(...)   (void)0


#endif
#endif
