/**
 * $Id: UrlRewriter.java 41284 2015-09-18 07:03:39Z dmorris $
 */
package com.untangle.node.web_filter;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import org.apache.log4j.Logger;

/**
 * Holds mappings between popular search engines and their safe search
 * HTTP requests.
 *
 * Created: Tue Sep 22 10:39:28 2009
 *
 */
public class UrlRewriter
{
    private static final Logger logger = Logger.getLogger(UrlRewriter.class);

    private static final Map<Pattern, String> safeSearchRewrites;
    static {
        safeSearchRewrites = new HashMap<Pattern, String>();
        safeSearchRewrites.put(Pattern.compile(".*google\\.[a-z]+(\\.[a-z]+)?/.+q=.*"), "safe=active");
        safeSearchRewrites.put(Pattern.compile(".*ask\\.[a-z]+(\\.[a-z]+)?/.+q=.*"), "adt=0");
        safeSearchRewrites.put(Pattern.compile(".*bing\\.[a-z]+(\\.[a-z]+)?/.+q=.*"), "adlt=strict");
        safeSearchRewrites.put(Pattern.compile(".*yahoo\\.[a-z]+(\\.[a-z]+)?/.+p=.*"), "vm=r");
    };

    private static final Map<Pattern, String> youtubeForSchoolsRewrites;
    static {
        youtubeForSchoolsRewrites = new HashMap<Pattern, String>();
        youtubeForSchoolsRewrites.put(Pattern.compile(".*youtube\\.[a-z]+(\\.[a-z]+)?/.+"), "edufilter=");
    };
    
    private static List<Pattern> excludes;
    static {
        excludes = new ArrayList<Pattern>();
        excludes.add(Pattern.compile(".*bing\\.[a-z]+(\\.[a-z]+)?/maps/.*"));
    };
    
    //http://support.google.com/youtube/bin/answer.py?hl=en&answer=1686318
    private static Pattern youtubeIgnorePattern = Pattern.compile("\\.(png|gif|js|xml|css)$");
    
    public static URI getSafeSearchUri(String host, URI uri)
    {
        String uriParam = getParam( safeSearchRewrites, host, uri );
        if (uriParam != null) {
            URI safeUri = URI.create(uri.toString() + "&" + uriParam);
            logger.debug("getUrlRewriterUri: '" + safeUri + "'");
            return safeUri;
        } else
            return null;
    }

    public static URI getYoutubeForSchoolsUri(String host, URI uri, String youtubeIdentifier)
    {
        String uriParam = getParam( youtubeForSchoolsRewrites, host, uri );
        if (uriParam != null) {
            if (youtubeIgnorePattern.matcher(uri.toString()).matches()) {
                return null;
            }

            String newUri;
            
            /**
             * If it already contains arguments, append to them.
             * Otherwise add them
             */
            if (uri.toString().contains("?"))
                newUri = uri.toString() + "&" + uriParam + youtubeIdentifier;
            else
                newUri = uri.toString() + "?" + uriParam + youtubeIdentifier;
                
            logger.debug("Original  URI: \"" + uri + "\"");
            logger.debug("Using new URI: \"" + newUri + "\"");

            URI youtubeUri = URI.create(newUri);
            logger.debug("getYoutubeForSchoolsUri: '" + youtubeUri + "'");
            return youtubeUri;
        } else
            return null;
    }

    private static String getParam(Map<Pattern, String> patterns, String host, URI uri)
    {
        String url = host + uri.toString();
        logger.debug("getUrlRewriterParam: trying to match string '" + url + "'");
        for (Pattern p : patterns.keySet()) {
            logger.debug("getUrlRewriterParam: ... with pattern '" + p.pattern() + "'");
            if (p.matcher(url).matches()) {
                logger.debug("getUrlRewriterParam: ...... match !");
                for (Pattern q : excludes) {
                    if (q.matcher(url).matches()) {
                        logger.debug("getUrlRewriterParam: ...... but it also matches an exclude !");
                        return null;
                    }
                }
                return patterns.get(p);
            }
        }
        return null;
    }

}