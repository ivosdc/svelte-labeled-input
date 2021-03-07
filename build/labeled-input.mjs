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
        node.parentNode.removeChild(node);
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
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
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
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
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
        flushing = false;
        seen_callbacks.clear();
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
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
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
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
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
            mount_component(component, options.target, options.anchor);
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
                // @ts-ignore todo: improve typings
                for (const key in this.$$.slotted) {
                    // @ts-ignore todo: improve typings
                    this.appendChild(this.$$.slotted[key]);
                }
            }
            attributeChangedCallback(attr, _oldValue, newValue) {
                this[attr] = newValue;
            }
            $destroy() {
                destroy_component(this, 1);
                this.$destroy = noop;
            }
            $on(type, callback) {
                // TODO should this delegate to addEventListener?
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

    /* src/LabeledInput.svelte generated by Svelte v3.24.1 */

    function create_else_block(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			input = element("input");
    			attr(input, "id", /*name*/ ctx[2]);
    			attr(input, "name", /*name*/ ctx[2]);
    			attr(input, "placeholder", /*placeholder*/ ctx[3]);
    			attr(input, "type", "text");
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[0]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler_1*/ ctx[11]),
    					listen(input, "blur", /*validate*/ ctx[6])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*name*/ 4) {
    				attr(input, "id", /*name*/ ctx[2]);
    			}

    			if (dirty & /*name*/ 4) {
    				attr(input, "name", /*name*/ ctx[2]);
    			}

    			if (dirty & /*placeholder*/ 8) {
    				attr(input, "placeholder", /*placeholder*/ ctx[3]);
    			}

    			if (dirty & /*value*/ 1 && input.value !== /*value*/ ctx[0]) {
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

    // (40:8) {#if type === "password"}
    function create_if_block(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			input = element("input");
    			attr(input, "id", /*name*/ ctx[2]);
    			attr(input, "name", /*name*/ ctx[2]);
    			attr(input, "placeholder", /*placeholder*/ ctx[3]);
    			attr(input, "type", "password");
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[0]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler*/ ctx[10]),
    					listen(input, "blur", /*validate*/ ctx[6])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*name*/ 4) {
    				attr(input, "id", /*name*/ ctx[2]);
    			}

    			if (dirty & /*name*/ 4) {
    				attr(input, "name", /*name*/ ctx[2]);
    			}

    			if (dirty & /*placeholder*/ 8) {
    				attr(input, "placeholder", /*placeholder*/ ctx[3]);
    			}

    			if (dirty & /*value*/ 1 && input.value !== /*value*/ ctx[0]) {
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
    	let main;
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
    		if (/*type*/ ctx[1] === "password") return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			main = element("main");
    			div = element("div");
    			span = element("span");
    			t0 = text(/*error*/ ctx[5]);
    			t1 = space();
    			if_block.c();
    			t2 = space();
    			label_1 = element("label");
    			t3 = text(/*label*/ ctx[4]);
    			this.c = noop;
    			attr(span, "class", "error");
    			attr(label_1, "for", /*name*/ ctx[2]);
    			attr(div, "class", "field");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, div);
    			append(div, span);
    			append(span, t0);
    			append(div, t1);
    			if_block.m(div, null);
    			append(div, t2);
    			append(div, label_1);
    			append(label_1, t3);

    			if (!mounted) {
    				dispose = listen(label_1, "click", /*setFocus*/ ctx[7]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*error*/ 32) set_data(t0, /*error*/ ctx[5]);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, t2);
    				}
    			}

    			if (dirty & /*label*/ 16) set_data(t3, /*label*/ ctx[4]);

    			if (dirty & /*name*/ 4) {
    				attr(label_1, "for", /*name*/ ctx[2]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(main);
    			if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { name } = $$props;
    	let { placeholder } = $$props;
    	let { value } = $$props;
    	let { label } = $$props;
    	let { errormessage } = $$props;
    	let { validator } = $$props;
    	let { type } = $$props;
    	type = type === undefined ? "text" : type;

    	const defaultValidator = () => {
    		return true;
    	};

    	let error = "";

    	const validate = event => {
    		if (validator === true) {
    			$$invalidate(5, error = "");
    			return true;
    		}

    		$$invalidate(5, error = errormessage);
    		return false;
    	};

    	function setFocus(e) {
    		let elem = document.getElementById(name);
    		elem.focus();
    	}

    	function input_input_handler() {
    		value = this.value;
    		$$invalidate(0, value);
    	}

    	function input_input_handler_1() {
    		value = this.value;
    		$$invalidate(0, value);
    	}

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(2, name = $$props.name);
    		if ("placeholder" in $$props) $$invalidate(3, placeholder = $$props.placeholder);
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    		if ("label" in $$props) $$invalidate(4, label = $$props.label);
    		if ("errormessage" in $$props) $$invalidate(9, errormessage = $$props.errormessage);
    		if ("validator" in $$props) $$invalidate(8, validator = $$props.validator);
    		if ("type" in $$props) $$invalidate(1, type = $$props.type);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*validator*/ 256) {
    			 $$invalidate(8, validator = validator === undefined ? defaultValidator() : validator);
    		}
    	};

    	return [
    		value,
    		type,
    		name,
    		placeholder,
    		label,
    		error,
    		validate,
    		setFocus,
    		validator,
    		errormessage,
    		input_input_handler,
    		input_input_handler_1
    	];
    }

    class LabeledInput extends SvelteElement {
    	constructor(options) {
    		super();
    		this.shadowRoot.innerHTML = `<style>.error{color:red;font-size:75%}.field{display:flex;flex-flow:column-reverse;margin-bottom:1.5em}label,input{transition:all 0.2s;touch-action:manipulation}label{position:relative;font-size:0.8em;top:0em}input{font-size:1em;border:0;border-bottom:1px solid #ccc;font-family:inherit;font-size:1em;font-weight:200;-webkit-appearance:none;border-radius:0;padding:0;cursor:text}input:focus{outline:0;border-bottom:1px solid #666}input:placeholder-shown+label{cursor:text;max-width:0%;white-space:nowrap;overflow:unset;text-overflow:ellipsis;transform-origin:left top;transform:translate(0, 1.2em) scale(1.2)}::-webkit-input-placeholder{opacity:0;transition:inherit}::-moz-placeholder{opacity:0;transition:inherit}input:focus::-webkit-input-placeholder{opacity:0.5}input:focus::-moz-placeholder{opacity:0.5}input:not(:placeholder-shown)+label,input:focus+label{transform:translate(0, 0) scale(1);cursor:pointer}</style>`;

    		init(this, { target: this.shadowRoot }, instance, create_fragment, safe_not_equal, {
    			name: 2,
    			placeholder: 3,
    			value: 0,
    			label: 4,
    			errormessage: 9,
    			validator: 8,
    			type: 1
    		});

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
    		return ["name", "placeholder", "value", "label", "errormessage", "validator", "type"];
    	}

    	get name() {
    		return this.$$.ctx[2];
    	}

    	set name(name) {
    		this.$set({ name });
    		flush();
    	}

    	get placeholder() {
    		return this.$$.ctx[3];
    	}

    	set placeholder(placeholder) {
    		this.$set({ placeholder });
    		flush();
    	}

    	get value() {
    		return this.$$.ctx[0];
    	}

    	set value(value) {
    		this.$set({ value });
    		flush();
    	}

    	get label() {
    		return this.$$.ctx[4];
    	}

    	set label(label) {
    		this.$set({ label });
    		flush();
    	}

    	get errormessage() {
    		return this.$$.ctx[9];
    	}

    	set errormessage(errormessage) {
    		this.$set({ errormessage });
    		flush();
    	}

    	get validator() {
    		return this.$$.ctx[8];
    	}

    	set validator(validator) {
    		this.$set({ validator });
    		flush();
    	}

    	get type() {
    		return this.$$.ctx[1];
    	}

    	set type(type) {
    		this.$set({ type });
    		flush();
    	}
    }

    customElements.define("labeled-input", LabeledInput);

    return LabeledInput;

}());
