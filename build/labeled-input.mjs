var LabeledInput = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }
    function attribute_to_object(attributes) {
        const result = {};
        for (const attribute of attributes) {
            result[attribute.name] = attribute.value;
        }
        return result;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    let SvelteElement;
    if (typeof HTMLElement === 'function') {
        SvelteElement = class extends HTMLElement {
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
            }
            connectedCallback() {
                const { on_mount } = this.$$;
                this.$$.on_disconnect = on_mount.map(run).filter(is_function);
                // @ts-ignore todo: improve typings
                for (const key in this.$$.slotted) {
                    // @ts-ignore todo: improve typings
                    this.appendChild(this.$$.slotted[key]);
                }
            }
            attributeChangedCallback(attr, _oldValue, newValue) {
                this[attr] = newValue;
            }
            disconnectedCallback() {
                run_all(this.$$.on_disconnect);
            }
            $destroy() {
                destroy_component(this, 1);
                this.$destroy = noop;
            }
            $on(type, callback) {
                // TODO should this delegate to addEventListener?
                if (!is_function(callback)) {
                    return noop;
                }
                const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
                callbacks.push(callback);
                return () => {
                    const index = callbacks.indexOf(callback);
                    if (index !== -1)
                        callbacks.splice(index, 1);
                };
            }
            $set($$props) {
                if (this.$$set && !is_empty($$props)) {
                    this.$$.skip_bound = true;
                    this.$$set($$props);
                    this.$$.skip_bound = false;
                }
            }
        };
    }

    /* src/LabeledInput.svelte generated by Svelte v3.59.2 */

    function create_if_block_3(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			input = element("input");
    			attr(input, "id", /*name*/ ctx[1]);
    			attr(input, "name", /*name*/ ctx[1]);
    			attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			attr(input, "min", /*min*/ ctx[8]);
    			attr(input, "max", /*max*/ ctx[9]);
    			attr(input, "type", "number");
    			attr(input, "tabindex", "0");
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[0]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler_2*/ ctx[28]),
    					listen(input, "input", /*dispatchInput*/ ctx[13]),
    					listen(input, "keyup", /*handleKeyUp*/ ctx[12]),
    					listen(input, "change", /*change_handler_3*/ ctx[29]),
    					listen(input, "blur", /*blur_handler_3*/ ctx[30]),
    					listen(input, "keypress", /*keypress_handler_3*/ ctx[31])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*name*/ 2) {
    				attr(input, "id", /*name*/ ctx[1]);
    			}

    			if (dirty[0] & /*name*/ 2) {
    				attr(input, "name", /*name*/ ctx[1]);
    			}

    			if (dirty[0] & /*placeholder*/ 4) {
    				attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			}

    			if (dirty[0] & /*min*/ 256) {
    				attr(input, "min", /*min*/ ctx[8]);
    			}

    			if (dirty[0] & /*max*/ 512) {
    				attr(input, "max", /*max*/ ctx[9]);
    			}

    			if (dirty[0] & /*value*/ 1 && to_number(input.value) !== /*value*/ ctx[0]) {
    				set_input_value(input, /*value*/ ctx[0]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (91:30) 
    function create_if_block_2(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			input = element("input");
    			attr(input, "id", /*name*/ ctx[1]);
    			attr(input, "name", /*name*/ ctx[1]);
    			attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			attr(input, "size", /*size*/ ctx[6]);
    			attr(input, "type", "text");
    			attr(input, "tabindex", "0");
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[0]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler_1*/ ctx[24]),
    					listen(input, "input", /*dispatchInput*/ ctx[13]),
    					listen(input, "keyup", /*handleKeyUp*/ ctx[12]),
    					listen(input, "change", /*change_handler_2*/ ctx[25]),
    					listen(input, "blur", /*blur_handler_2*/ ctx[26]),
    					listen(input, "keypress", /*keypress_handler_2*/ ctx[27])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*name*/ 2) {
    				attr(input, "id", /*name*/ ctx[1]);
    			}

    			if (dirty[0] & /*name*/ 2) {
    				attr(input, "name", /*name*/ ctx[1]);
    			}

    			if (dirty[0] & /*placeholder*/ 4) {
    				attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			}

    			if (dirty[0] & /*size*/ 64) {
    				attr(input, "size", /*size*/ ctx[6]);
    			}

    			if (dirty[0] & /*value*/ 1 && input.value !== /*value*/ ctx[0]) {
    				set_input_value(input, /*value*/ ctx[0]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (83:30) 
    function create_if_block_1(ctx) {
    	let textarea;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			textarea = element("textarea");
    			attr(textarea, "id", /*name*/ ctx[1]);
    			attr(textarea, "name", /*name*/ ctx[1]);
    			attr(textarea, "placeholder", /*placeholder*/ ctx[2]);
    			attr(textarea, "rows", /*rows*/ ctx[7]);
    			attr(textarea, "cols", /*size*/ ctx[6]);
    			attr(textarea, "tabindex", "0");
    		},
    		m(target, anchor) {
    			insert(target, textarea, anchor);
    			set_input_value(textarea, /*value*/ ctx[0]);

    			if (!mounted) {
    				dispose = [
    					listen(textarea, "input", /*textarea_input_handler*/ ctx[20]),
    					listen(textarea, "input", /*dispatchInput*/ ctx[13]),
    					listen(textarea, "keyup", /*handleKeyUp*/ ctx[12]),
    					listen(textarea, "change", /*change_handler_1*/ ctx[21]),
    					listen(textarea, "blur", /*blur_handler_1*/ ctx[22]),
    					listen(textarea, "keypress", /*keypress_handler_1*/ ctx[23])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*name*/ 2) {
    				attr(textarea, "id", /*name*/ ctx[1]);
    			}

    			if (dirty[0] & /*name*/ 2) {
    				attr(textarea, "name", /*name*/ ctx[1]);
    			}

    			if (dirty[0] & /*placeholder*/ 4) {
    				attr(textarea, "placeholder", /*placeholder*/ ctx[2]);
    			}

    			if (dirty[0] & /*rows*/ 128) {
    				attr(textarea, "rows", /*rows*/ ctx[7]);
    			}

    			if (dirty[0] & /*size*/ 64) {
    				attr(textarea, "cols", /*size*/ ctx[6]);
    			}

    			if (dirty[0] & /*value*/ 1) {
    				set_input_value(textarea, /*value*/ ctx[0]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(textarea);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (75:4) {#if type === "password"}
    function create_if_block(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			input = element("input");
    			attr(input, "id", /*name*/ ctx[1]);
    			attr(input, "name", /*name*/ ctx[1]);
    			attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			attr(input, "size", /*size*/ ctx[6]);
    			attr(input, "type", "password");
    			attr(input, "tabindex", "0");
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[0]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler*/ ctx[16]),
    					listen(input, "input", /*dispatchInput*/ ctx[13]),
    					listen(input, "keyup", /*handleKeyUp*/ ctx[12]),
    					listen(input, "change", /*change_handler*/ ctx[17]),
    					listen(input, "blur", /*blur_handler*/ ctx[18]),
    					listen(input, "keypress", /*keypress_handler*/ ctx[19])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*name*/ 2) {
    				attr(input, "id", /*name*/ ctx[1]);
    			}

    			if (dirty[0] & /*name*/ 2) {
    				attr(input, "name", /*name*/ ctx[1]);
    			}

    			if (dirty[0] & /*placeholder*/ 4) {
    				attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			}

    			if (dirty[0] & /*size*/ 64) {
    				attr(input, "size", /*size*/ ctx[6]);
    			}

    			if (dirty[0] & /*value*/ 1 && input.value !== /*value*/ ctx[0]) {
    				set_input_value(input, /*value*/ ctx[0]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div;
    	let span;
    	let t0;
    	let t1;
    	let t2;
    	let label_1;
    	let t3;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*type*/ ctx[5] === "password") return create_if_block;
    		if (/*type*/ ctx[5] === "area") return create_if_block_1;
    		if (/*type*/ ctx[5] === "text") return create_if_block_2;
    		if (/*type*/ ctx[5] === "number") return create_if_block_3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			span = element("span");
    			t0 = text(/*errormessage*/ ctx[4]);
    			t1 = space();
    			if (if_block) if_block.c();
    			t2 = space();
    			label_1 = element("label");
    			t3 = text(/*label*/ ctx[3]);
    			this.c = noop;
    			attr(span, "class", "error");
    			attr(label_1, "for", /*name*/ ctx[1]);
    			attr(div, "class", "field");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, span);
    			append(span, t0);
    			append(div, t1);
    			if (if_block) if_block.m(div, null);
    			append(div, t2);
    			append(div, label_1);
    			append(label_1, t3);

    			if (!mounted) {
    				dispose = listen(label_1, "click", /*setFocus*/ ctx[11]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*errormessage*/ 16) set_data(t0, /*errormessage*/ ctx[4]);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, t2);
    				}
    			}

    			if (dirty[0] & /*label*/ 8) set_data(t3, /*label*/ ctx[3]);

    			if (dirty[0] & /*name*/ 2) {
    				attr(label_1, "for", /*name*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);

    			if (if_block) {
    				if_block.d();
    			}

    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { name = '' } = $$props;
    	let { placeholder = '' } = $$props;
    	let { value = '' } = $$props;
    	let { label = '' } = $$props;
    	let { errormessage = '' } = $$props;

    	let { validator = x => {
    		return [];
    	} } = $$props;

    	let { type = 'text' } = $$props;
    	let { size = '20' } = $$props;
    	let { rows = '2' } = $$props;
    	let { min = '' } = $$props;
    	let { max = '' } = $$props;
    	let { shadowed = false } = $$props;
    	const dispatch = createEventDispatcher();
    	let error = '';

    	const validate = event => {
    		if (validator !== undefined && validator !== null) {
    			let violations = validator(value);

    			if (violations.length === 0) {
    				error = "";
    				return true;
    			}

    			if (Array.isArray(violations)) {
    				error = violations.map(o => o.message).join(", ");
    			} else {
    				error = violations;
    			}

    			customDispatch(event, "error", error);
    			return false;
    		} else {
    			return true;
    		}
    	};

    	function setFocus(e) {
    		let elem = e.target.closest(name);
    		elem.focus();
    	}

    	function handleKeyUp(e) {
    		customDispatch(e, "keyup", { key: e.key });
    	}

    	function dispatchInput(e) {
    		validate(e);
    		customDispatch(e, 'input', value);
    	}

    	function customDispatch(event, name, details) {
    		if (shadowed) {
    			event.target.dispatchEvent(new CustomEvent(name, { composed: true, detail: details }));
    		} else {
    			dispatch(name, details);
    		}
    	}

    	function input_input_handler() {
    		value = this.value;
    		$$invalidate(0, value);
    	}

    	const change_handler = e => {
    		dispatch('change', value);
    	};

    	const blur_handler = e => {
    		dispatch('blur', value);
    	};

    	const keypress_handler = e => {
    		dispatch('keypress', value);
    	};

    	function textarea_input_handler() {
    		value = this.value;
    		$$invalidate(0, value);
    	}

    	const change_handler_1 = e => {
    		dispatch('change', value);
    	};

    	const blur_handler_1 = e => {
    		dispatch('blur', value);
    	};

    	const keypress_handler_1 = e => {
    		dispatch('keypress', value);
    	};

    	function input_input_handler_1() {
    		value = this.value;
    		$$invalidate(0, value);
    	}

    	const change_handler_2 = e => {
    		dispatch('change', value);
    	};

    	const blur_handler_2 = e => {
    		dispatch('blur', value);
    	};

    	const keypress_handler_2 = e => {
    		dispatch('keypress', value);
    	};

    	function input_input_handler_2() {
    		value = to_number(this.value);
    		$$invalidate(0, value);
    	}

    	const change_handler_3 = e => {
    		dispatch('change', value);
    	};

    	const blur_handler_3 = e => {
    		dispatch('blur', value);
    	};

    	const keypress_handler_3 = e => {
    		dispatch('keypress', value);
    	};

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(1, name = $$props.name);
    		if ('placeholder' in $$props) $$invalidate(2, placeholder = $$props.placeholder);
    		if ('value' in $$props) $$invalidate(0, value = $$props.value);
    		if ('label' in $$props) $$invalidate(3, label = $$props.label);
    		if ('errormessage' in $$props) $$invalidate(4, errormessage = $$props.errormessage);
    		if ('validator' in $$props) $$invalidate(14, validator = $$props.validator);
    		if ('type' in $$props) $$invalidate(5, type = $$props.type);
    		if ('size' in $$props) $$invalidate(6, size = $$props.size);
    		if ('rows' in $$props) $$invalidate(7, rows = $$props.rows);
    		if ('min' in $$props) $$invalidate(8, min = $$props.min);
    		if ('max' in $$props) $$invalidate(9, max = $$props.max);
    		if ('shadowed' in $$props) $$invalidate(15, shadowed = $$props.shadowed);
    	};

    	return [
    		value,
    		name,
    		placeholder,
    		label,
    		errormessage,
    		type,
    		size,
    		rows,
    		min,
    		max,
    		dispatch,
    		setFocus,
    		handleKeyUp,
    		dispatchInput,
    		validator,
    		shadowed,
    		input_input_handler,
    		change_handler,
    		blur_handler,
    		keypress_handler,
    		textarea_input_handler,
    		change_handler_1,
    		blur_handler_1,
    		keypress_handler_1,
    		input_input_handler_1,
    		change_handler_2,
    		blur_handler_2,
    		keypress_handler_2,
    		input_input_handler_2,
    		change_handler_3,
    		blur_handler_3,
    		keypress_handler_3
    	];
    }

    class LabeledInput extends SvelteElement {
    	constructor(options) {
    		super();
    		const style = document.createElement('style');
    		style.textContent = `:root{--textarea-border:#e1e1e1;--textarea-border-focus:#bfbfbf;--font-color:#333333;--border-bottom:#999999;--border-bottom-hover:#4A849F;--font-size:1em}.error{width:100%;color:var(--border-bottom);font-size:12px;min-height:14px;max-height:14px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}.field{display:flex;flex-flow:column-reverse}label,input,textarea{transition:all 0.3s;touch-action:manipulation;width:inherit}label{position:relative;font-size:0.8em;top:-1px;color:var(--border-bottom);max-width:0;height:21px;white-space:nowrap}input,textarea{border:0;border-bottom:2px solid var(--border-bottom);font-family:inherit;font-weight:200;font-size:var(--font-size);appearance:none;border-radius:0.3em;cursor:text;color:var(--font-color);padding:0 0.5em 2px 0.5em}textarea{border-top:1px solid var(--textarea-border);border-right:1px solid var(--textarea-border);border-bottom:2px solid var(--border-bottom);padding:0.3em 0.5em;margin-top:-4px}textarea:focus{border:1px solid var(--textarea-border-focus);outline:0;border-bottom:2px solid var(--border-bottom-hover)}input:focus{outline:0;border-bottom:2px solid var(--border-bottom-hover)}input:placeholder-shown+label,textarea:placeholder-shown+label{cursor:text;max-width:0;white-space:nowrap;overflow:unset;text-overflow:ellipsis;transform-origin:left top;transform:translate(0, 1.5em) scale(1.3)}::placeholder{opacity:0;transition:inherit}input:focus::placeholder,textarea:focus::placeholder{opacity:0.5}input:not(:placeholder-shown)+label,input:focus+label{transform:translate(0, -3px) scale(1.1);cursor:pointer}textarea:not(:placeholder-shown)+label,textarea:focus+label{transform:translate(0, -3px) scale(1.1);cursor:pointer}`;
    		this.shadowRoot.appendChild(style);

    		init(
    			this,
    			{
    				target: this.shadowRoot,
    				props: attribute_to_object(this.attributes),
    				customElement: true
    			},
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{
    				name: 1,
    				placeholder: 2,
    				value: 0,
    				label: 3,
    				errormessage: 4,
    				validator: 14,
    				type: 5,
    				size: 6,
    				rows: 7,
    				min: 8,
    				max: 9,
    				shadowed: 15
    			},
    			null,
    			[-1, -1]
    		);

    		if (options) {
    			if (options.target) {
    				insert(options.target, this, options.anchor);
    			}

    			if (options.props) {
    				this.$set(options.props);
    				flush();
    			}
    		}
    	}

    	static get observedAttributes() {
    		return [
    			"name",
    			"placeholder",
    			"value",
    			"label",
    			"errormessage",
    			"validator",
    			"type",
    			"size",
    			"rows",
    			"min",
    			"max",
    			"shadowed"
    		];
    	}

    	get name() {
    		return this.$$.ctx[1];
    	}

    	set name(name) {
    		this.$$set({ name });
    		flush();
    	}

    	get placeholder() {
    		return this.$$.ctx[2];
    	}

    	set placeholder(placeholder) {
    		this.$$set({ placeholder });
    		flush();
    	}

    	get value() {
    		return this.$$.ctx[0];
    	}

    	set value(value) {
    		this.$$set({ value });
    		flush();
    	}

    	get label() {
    		return this.$$.ctx[3];
    	}

    	set label(label) {
    		this.$$set({ label });
    		flush();
    	}

    	get errormessage() {
    		return this.$$.ctx[4];
    	}

    	set errormessage(errormessage) {
    		this.$$set({ errormessage });
    		flush();
    	}

    	get validator() {
    		return this.$$.ctx[14];
    	}

    	set validator(validator) {
    		this.$$set({ validator });
    		flush();
    	}

    	get type() {
    		return this.$$.ctx[5];
    	}

    	set type(type) {
    		this.$$set({ type });
    		flush();
    	}

    	get size() {
    		return this.$$.ctx[6];
    	}

    	set size(size) {
    		this.$$set({ size });
    		flush();
    	}

    	get rows() {
    		return this.$$.ctx[7];
    	}

    	set rows(rows) {
    		this.$$set({ rows });
    		flush();
    	}

    	get min() {
    		return this.$$.ctx[8];
    	}

    	set min(min) {
    		this.$$set({ min });
    		flush();
    	}

    	get max() {
    		return this.$$.ctx[9];
    	}

    	set max(max) {
    		this.$$set({ max });
    		flush();
    	}

    	get shadowed() {
    		return this.$$.ctx[15];
    	}

    	set shadowed(shadowed) {
    		this.$$set({ shadowed });
    		flush();
    	}
    }

    customElements.define("labeled-input", LabeledInput);

    return LabeledInput;

}());
