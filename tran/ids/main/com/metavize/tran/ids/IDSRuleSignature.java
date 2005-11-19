package com.metavize.tran.ids;

import java.lang.reflect.*;
import java.util.List;
import java.util.ListIterator;
import java.util.Vector;

import com.metavize.mvvm.MvvmContextFactory;
import com.metavize.mvvm.tapi.IPSession;
import com.metavize.mvvm.tapi.event.*;
import com.metavize.mvvm.tran.Transform;
import com.metavize.tran.ids.options.*;
import org.apache.log4j.Logger;

public class IDSRuleSignature {

    /***************************************
     * These are options that are safe to ignore
     * Any other option *WILL DROP THE RULE*
     *
     * These rules should all be added at some point!
     *****************************************/
    private String[] ignoreSafeOptions = { "rev","sid","reference","priority" };
    /** **************************************/

    private static final int BLOCK_COUNTER  = Transform.GENERIC_0_COUNTER;
    private static final int PASS_COUNTER   = Transform.GENERIC_1_COUNTER;
    private static final int LOG_COUNTER    = Transform.GENERIC_2_COUNTER;
    private static final int ALERT_COUNTER  = Transform.GENERIC_3_COUNTER;

    private List<IDSOption> options = new Vector<IDSOption>();

    private IDSRule rule;
    private String toString = "Starting..";
    private String message = "No message set";
    private int action;
    private boolean removeFlag = false;

    private static final Logger log = Logger.getLogger(IDSRuleSignature.class);

    public IDSRuleSignature(int action, IDSRule rule) {
        this.action = action;
        this.rule = rule;
    }

    public void remove(boolean remove) {
        removeFlag = remove;
    }

    public boolean remove() {
        return removeFlag;
    }

    public IDSRule rule() {
        return rule;
    }

    public void addOption(String optionName, String params, boolean initializeSettingsTime) {
        for(int i = 0; i < ignoreSafeOptions.length; i++) {
            if(optionName.equalsIgnoreCase(ignoreSafeOptions[i]))
                return;
        }

        IDSOption option = IDSOption.buildOption(this,optionName,params, initializeSettingsTime);
        if(option != null && option.runnable())
            options.add(option);
        else if(option == null) {
            log.info("Could not add option: " + optionName);
            removeFlag = true;
        }
    }

    public IDSOption getOption(String name, IDSOption callingOption) {
        /**Have to iterate backwards over the options so that options that
         * act as modifiers will modify the correct option
         * eg, in situations where there are multiple content options.
         */
        int index = options.indexOf(callingOption);
        index = (index < 0) ? options.size():index;

        ListIterator<IDSOption> it = options.listIterator(index);
        Class optionDefinition = null;
        try {
            optionDefinition = Class.forName("com.metavize.tran.ids.options."+name);
        } catch (ClassNotFoundException e) {
            log.error("Could not load option: " + e.getMessage());
        }
        while(it.hasPrevious()) {
            IDSOption option = it.previous();
            if(optionDefinition.isInstance(option))
                return option;
        }
        return null;
    }

    public void setMessage(String msg) {
        message = msg;
    }

    public String getMessage() {
        return message;
    }

    public boolean execute(IDSSessionInfo info) {
        IDSTransformImpl transform = (IDSTransformImpl)MvvmContextFactory.context().transformManager().threadContext().transform();
        IDSDetectionEngine engine = transform.getEngine();

        for(IDSOption option : options) {
            if(false == option.run(info)) {
                // do not execute
                transform.statisticManager.incrDNC();
                engine.updateUICount(PASS_COUNTER); // did-not-cares are passed
                return false;
            }
        }

        doAction(info); // execute
        return true;
    }

    private void doAction(IDSSessionInfo info) {
        IPSession session = info.getSession();
        if (null == session) {
            log.error("Session is null; cannot act on event: " + message);
            return;
        }

        // XXX this is not a good way to get a reference to the transform
        IDSTransformImpl ids = (IDSTransformImpl)MvvmContextFactory.context().transformManager().threadContext().transform();
        IDSDetectionEngine engine = ids.getEngine();

        boolean blocked = false;
        switch(action) {
        case IDSRuleManager.ALERT:
            log.debug("Alert: "+message);
            ids.statisticManager.incrLogged();
            engine.updateUICount(ALERT_COUNTER);
            break;

        case IDSRuleManager.LOG:
            log.debug("Log: "+message);
            ids.statisticManager.incrLogged();
            engine.updateUICount(LOG_COUNTER);
            break;

        case IDSRuleManager.BLOCK:
            log.debug("Block: "+message);
            blocked = true;
            ids.statisticManager.incrBlocked();
            engine.updateUICount(BLOCK_COUNTER);
            info.blockSession();
            break;
        }

        ids.log(new IDSLogEvent(session.pipelineEndpoints(),message,blocked)); //Add list number that this rule came from
    }

    public void setToString(String string) {
        toString = string;
    }

    public String toString() {
        return toString;
    }
}
