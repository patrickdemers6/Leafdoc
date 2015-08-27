var sander = require('sander');

var template = require('./template'),
    getTemplate = template.getTemplate,
    setTemplateDir = template.setTemplate;

var regexps = require('./regexps');

// 🍂class Leafdoc
// Represents the Leafdoc parser
function Leafdoc(options){
	this._namespaces = {};
	this._knownDocumentables = [
		'example',
		'factory',
		'option',
		'event',
		'method',
		'function',
		'property'
	];
	this._AKAs = {};

	if (options) {
		if (options.templateDir) {
			setTemplatedir(options.templateDir);
		}
	}
};

/*
 * 🍂factory Leafdoc(options: LeafdocOptions)
 * Constructor for a new Leafdoc parser
 *
 * 🍂section
 * 🍂aka LeafdocOptions
 * 🍂option templateDir: String = 'basic'
 * Defines which subdirectory in `templates/` to use for building up the HTML.
 *
 * 🍂example
 *
 * Output Leafdoc's own documentation to the console with:
 *
 * ```
 * var LeafDoc = require('./src/leafdoc.js');
 * var doc = new LeafDoc();
 * 	doc.addFile('src/leafdoc.js');
 *
 * console.log( doc.outputStr() );
 * ```
 */



// 🍂method addDir (dirname: String, extension: String): this
// Recursively scans a directory, and parses any files that match the given `extension`
Leafdoc.prototype.addDir = function(dirname, extension) {

	/// TODO
	return this;
};



// 🍂method addFile(filename: String): this
// Parses the given file
Leafdoc.prototype.addFile = function(filename) {
	return this.addBuffer(sander.readFileSync(filename));
};



// 🍂method addBuffer(buf: Buffer): this
// Parses the given buffer
Leafdoc.prototype.addBuffer = function(buf) {
	return this.addStr(buf.toString());
};

// 🍂method addStr(str: String): this
// Parses the given string for Leafdoc comments
Leafdoc.prototype.addStr = function(str) {

	// Leaflet files use DOS line feeds, which screw up things.
	str = str.replace(/\r\n?/g, '\n');


	var ns = '__default';	// namespace (or class)
	var sec = '__default';	// section
	var dt = '';	// Type of documentable
	var dc = '';	// Name of documentable
	var alt = 0;	// Will auto-increment for documentables with 🍂alternative
	var altAppliesTo = null;	// Ensures 'alt' resets when documentable changes

	// Scope of the current line (parser state): ns, sec or dc.
	// (namespace, section, documentable)
	var scope = '';

	var namespaces = this._namespaces;

	var currentNamespace, currentSection, currentDocumentable;

	// Temporal placeholder - section comments and AKAs are dangling until
	// the documentable type is known
	var sectionComments = [];
	var sectionAKA = [];


	/// TODO: Instead of using a regexp for comment blocks, allow using
	/// another regexp which matches a whole file, for files containing just docs.

	// 1: Fetch comment blocks (in a regexp loop). For each block...
	var match;
	while(match = regexps.commentBlock.exec(str)) {

		var multilineComment = match[1];
		var blockComment = match[2];
		var commentBlock = multilineComment || blockComment;
		var blockIsEmpty = true;
// 		console.error('new block: ', commentBlock);
// 		console.log('new block');

// 		if (multilineComment) {
// 			console.log('multiline block: {{{\n', multilineComment , '}}}');
// 		} else {
// 			console.log('block comment: {{{\n', blockComment , '}}}');
// 		}

		// Which regex should we use to clean each line?
// 		var regex = multilineComment ? this._leadingLineRegex : regexps.leadingBlock;
		var regex = multilineComment ? regexps.leadingLine : regexps.leadingBlock;

		// 2: Strip leading asterisk/slashes and whitespace and split into lines
		var lines = commentBlock.split('\n');
// 		while(match = regex.exec(commentBlock)) {
		for (var i in lines) {
			var line = lines[i];
// 			console.log('Line: ' + (multilineComment?'/':'*') + ' <' + line + '>');
			var match = regex.exec(line);
			var lineStr = match[1];
			var validLine = false;
			var directive, content;

// 			console.log('Line→ ' + (multilineComment?'/':'*') + ' <' + lineStr + '>');

			// 3: Parse 🍂 directives
// 			match = this._leafDirectiveRegex.exec(lineStr);
			match = regexps.leafDirective.exec(lineStr);
			if (match) {
				// In "🍂param foo, bar", directive is "param" and content is "foo, bar"
				directive = match[1];
				content = match[2];
				if (content) {content = content.trimRight(); }
				validLine = true;
// 				if (multilineComment) console.log(directive, match);
				if (directive === 'class' || directive === 'namespace') {
					ns = content.trim();
					sec = '__default';
					scope = 'ns';
				} else if (directive === 'section') {
					sec = content || '__default';
					scope = 'sec';
				} else if (this._knownDocumentables.indexOf(directive) !== -1 ) {
					scope = 'dc';
					dt = directive;
					dc = '';	// The name of the documentable will be set later
				}

				blockIsEmpty = false;
			} else {
				if (!blockIsEmpty) {
					directive = 'comment';
					content = lineStr;
					validLine = true;
				}
			}


			if (validLine) {

// 				console.log(scope, '-', directive, '-', content);

				if (scope === 'ns') {
					if (!namespaces.hasOwnProperty(ns)) {
						namespaces[ns] = {
							name: ns,
							aka: [],
							comments: [],
							supersections: {},
							inherits: []
						};
					}

					if (directive === 'aka') {
						namespaces[ns].aka.push(content);
					}
					if (directive === 'comment') {
						namespaces[ns].comments.push(content);
					}
					if (directive === 'inherits') {
						namespaces[ns].inherits.push(content);
					}

					currentNamespace = namespaces[ns];
				}

				if (scope === 'sec') {
					if (directive === 'comment') {
						sectionComments.push(content);
					}
					if (directive === 'aka') {
						sectionAKA.push(content);
					}
				}

				if (scope === 'dc') {

					if (!currentNamespace.supersections.hasOwnProperty(dt)) {
						currentNamespace.supersections[dt] = {
							name: dt,
							aka: [],
							comments: [],
							sections: {}
						};
					}
					if (!currentNamespace.supersections[dt].sections.hasOwnProperty(sec)) {
						currentNamespace.supersections[dt].sections[sec] = {
							name: sec,
							aka: sectionAKA,
							comments: sectionComments,
							documentables: {}
						};
						sectionAKA = [];
						sectionComments = [];
					}
					currentSection = currentNamespace.supersections[dt].sections[sec];

// 					console.log(currentSection);
// 					console.log(directive);

					if (this._knownDocumentables.indexOf(directive) !== -1 ) {
						// Documentables might have more than their name as content.
						// All documentables will follow the syntax for functions,
						//   with optional parameters, optional type, and optional default value.

// 						console.log(content, ', ', alt);

						var name, params = {}, type = null, defaultValue = null;

						if (content) {
							var split = regexps.functionDefinition.exec(content);
							name = split[1];
							paramString = split[2];
							type = split[3];
							defaultValue = split[4];

							if (paramString) {
								while(match = regexps.functionParam.exec(paramString)) {
									params[ match[1] ] = {name: match[1], type: match[2]};
								}
							}
// 							console.log(params);

						} else {
							name = '__default';
						}

						// Handle alternatives - just modify the name if 'alt' and 'altAppliesTo' match
						if (altAppliesTo === name) {
							dc = name + '-alternative-' + alt;
						} else {
							dc = name;
							alt = 0;
							altAppliesTo = null;
						}

						if (!currentSection.documentables.hasOwnProperty(dc)) {
							currentSection.documentables[dc] = {
								name: name,
								aka: [],
								comments: [],
								params: params,	// Only for functions/methods/factories
								type: type || null,
								defaultValue: defaultValue || null	// Only for options, properties
							}
						}
						currentDocumentable = currentSection.documentables[dc];

					} else if (directive === 'alternative') {
						alt++;
						// Alternative applies to current documentable name; if name
						// doesn't match, alternative has no effect.
						altAppliesTo = currentDocumentable.name;

					} else if (directive === 'param') {
						// Params are param name, type.
						/// TODO: Think about default values, or param explanation.
						var split = content.split(',');
						var paramName = split[0].trim();

						var paramType = split[1] ? split[1].trim() : '';
						currentDocumentable.params[paramName] = {name: paramName, type: paramType};

					} else if (directive === 'aka') {
						currentDocumentable.aka.push(content);
					} else if (directive === 'comment') {
// 						console.log('Doing stuff with a method comments: ', content);
						currentDocumentable.comments.push(content);
					}

				}

			}

		}

	}

// 	console.log(this._namespaces.Leafdoc.__default[0]);
// 	console.log(this._namespaces.Marker.__default[0]);
// 	console.log(this._namespaces);
// 	console.log(this._namespaces.Marker.supersections.method.sections.__default);
// 	console.log('namespaces after addStr', this._namespaces);

	return this;
};


// Matches: functionName (parameters): returnType
/// TODO: Use regenerate + unicode-7.0.0 npm packages to build regexps which
/// respect ID_Start and ID_Continue
Leafdoc.prototype._functionRexExp = new RegExp(/^(\S+)\s*(?:\((.*)\))?(?::\s*(\S+))/);

// Given a string, returns the documentable skeleton, like a factory.
// The function might have parameters and return value.
// Also works for methods, so `type` must be either `'function'` or `'method'`.
Leafdoc.prototype._parseFunction = function(str, type) {





};







/*
 * 🍂method outputStr: String
 * Outputs the documentation to a string.
 * Use only after all the needed files have been parsed.
 */
Leafdoc.prototype.outputStr = function() {

	this._resolveAKAs();

	var out = '';
	for (var ns in this._namespaces) {

		out += this._stringifyNamespace(this._namespaces[ns]);
	}
	
	return (getTemplate('html'))({body: out});
	
};

Leafdoc.prototype._stringifyNamespace = function(namespace) {
	var out = '';

	var inheritances = this._flattenInheritances(namespace.name);

	/// Ensure explicit order of the supersections (known types of documentable:
	/// example, factory, options, events, methods, properties
	for (var i in this._knownDocumentables) {
		var s = this._knownDocumentables[i];
		if (namespace.supersections.hasOwnProperty(s)) {
			out += this._stringifySupersection(namespace.supersections[s], inheritances, namespace.name);
		}
	}

// 	console.log(namespace);

	return (getTemplate('namespace'))({
		name: namespace.name,
		id: namespace.id,
		comments: namespace.comments,
		supersections: out
	});
};



Leafdoc.prototype._stringifySupersection = function(supersection, ancestors, namespacename) {
	var sections = '';
	var inheritances = '';

	for (var s in supersection.sections) {
		sections += this._stringifySection(supersection.sections[s], supersection.name, false);
	}

	var name = supersection.name;

	var label = name;
	if (name === 'method')   { label = 'Methods';       }
	if (name === 'function') { label = 'Functions';     }
	if (name === 'factory')  { label = 'Creation';      }
	if (name === 'example')  { label = 'Usage example'; }
	if (name === 'event')    { label = 'Events';        }
	if (name === 'option')   { label = 'Options';       }
	if (name === 'property') { label = 'Properties';    }


	// Calculate inherited documentables.
	// In the order of the ancestors, check if each documentable has already been
	// selected for output, skip it if so. Group rest into inherited sections.
	if (name === 'method' ||
	    name === 'function' ||
	    name === 'event' ||
	    name === 'option' ||
	    name === 'property') {

		if (ancestors.length) {
// 			inheritances += 'Inherits stuff from: ' + inheritances.join(',');

			var inheritedSections = [];

			// Build a list of the documentables which have been already outputted
			var skip = [];
			for (var s in supersection.sections) {
				var section = supersection.sections[s];
				for (var d in section.documentables) {
					skip.push(d);
				}
			}
// 			console.log('Will skip: ', skip);

			for (var i in ancestors) {
				var id = [];	// Inherited documentables
				var parent = ancestors[i];

// 				console.log('Processing ancestor ', parent);

				if (this._namespaces[parent].supersections.hasOwnProperty(name)) {
					var parentSupersection = this._namespaces[parent].supersections[name];
					for (var s in parentSupersection.sections) {

						var parentSection = parentSupersection.sections[s];
						if (parentSection) {
							var inheritedSection = {
								name: parentSection.name === '__default' ? label : parentSection.name,
								parent: parent,
								documentables: [],
								id: parentSection.id
							};

							for (var d in parentSection.documentables) {
// 								console.log('Checking if should show inherited ', d);
								if (skip.indexOf(d) === -1) {
									skip.push(d);
									inheritedSection.documentables.push(parentSection.documentables[d]);
								}
							}

// 							console.log(inheritedSection.documentables);

							if (inheritedSection.documentables.length) {
								inheritedSections.push(inheritedSection);
							} else {
// 								console.log('Everything from inherited section has been overwritten', parent, name);
							}
						}
					}
				}
			}

			// Inherited sections have been calculated, template them away.
			for (var i in inheritedSections) {
				var inheritedSection = inheritedSections[i];
				inheritances += (getTemplate('inherited'))({
					name: inheritedSection.name,
					ancestor: inheritedSection.parent,
					inherited: this._stringifySection(inheritedSection, supersection.name, namespacename),
					id: inheritedSection.id
				});
			}
		}
	}


	return (getTemplate('supersection'))({
		name: label,
		id: supersection.id,
		comments: supersection.comments,
		sections: sections,
		inheritances: inheritances
	});
};



Leafdoc.prototype._stringifySection = function(section, documentableType, inheritingNamespace) {
	var name = (section.name === '__default' || inheritingNamespace) ? '' : section.name;

// 	if (name) console.log('Named section:', section);
// 	console.log('Section:', section);


	// If inheriting, recreate the documentable changing the ID.
	var docs = section.documentables;
	if (inheritingNamespace) {
		docs = [];
		for (var i in section.documentables) {
			var oldDoc = section.documentables[i];
			docs.push({
				name: oldDoc.name,
				comments: oldDoc.comments,
				params: oldDoc.params,
				type: oldDoc.type,
				defaultValue: oldDoc.defaultValue,
				id: this._normalizeName(inheritingNamespace, oldDoc.name)
			});
		}

// 		console.log(docs);
	}

	return (getTemplate('section'))({
		name: name,
		id: section.id,
		comments: section.comments,
		documentables:(getTemplate(documentableType))({
			documentables: docs
		})
	});
};



// Loop through all the documentables, create an _anchor property, and
// return a plain object containing a map of all valid link names to their anchors.
Leafdoc.prototype._resolveAKAs = function() {
	for (var ns in this._namespaces) {
		var namespace = this._namespaces[ns];
		namespace.id = this._normalizeName(namespace.name);
		this._assignAKAs(namespace.id, namespace.aka);
		this._assignAKAs(namespace.id, [namespace.name]);
// 		console.log('Resolve namespace AKAs: ', namespace.id, namespace.name, namespace.aka);

		for (var ss in namespace.supersections) {
// 			console.log(namespace.supersections[ss]);
			var supersection = namespace.supersections[ss];
			var documentableType = supersection.name;
			supersection.id = this._normalizeName(namespace.name, supersection.name);

			this._assignAKAs(supersection.id, [supersection.id + 's'])

			for (var s in supersection.sections) {
				var section = supersection.sections[s];
				section.id = this._normalizeName(namespace.name, section.name === '__default' ? documentableType : section.name);
				this._assignAKAs(section.id, section.aka);
// 				console.log('Resolve section AKAs: ', section.id, section.name, section.aka);
				for (var d in section.documentables) {
					var doc = section.documentables[d];

					if (doc.name !== '__default') {	// Skip comments and examples
						doc.id = this._normalizeName(namespace.name, doc.name);
						this._assignAKAs(doc.id, doc.aka);
// 						console.log('Resolve doc AKAs: ', doc.id, doc.name, doc.aka);
					}
				}
			}
		}
	}

	template.setAKAs(this._AKAs);
// 	console.log(this._AKAs);
};


Leafdoc.prototype._normalizeName = function(namespace, name) {
	var id = namespace + (name ? '-' + name : '');
	id = id.trim().replace(/[\s\.]/g, '-');
	return id.toLowerCase();
};

Leafdoc.prototype._assignAKAs = function(id, akas) {
	this._AKAs[id] = id;
	for (var i in akas) {
		this._AKAs[akas[i].trim()] = id;
	}
};


// Given a class/namespace, recurse through inherited classes to build
// up an ordered list of clases/namespaces this class inherits from.
Leafdoc.prototype._flattenInheritances = function(classname, inheritancesSoFar) {

	if (!inheritancesSoFar) {
// 		console.log('Resolving inheritances for ', classname);
		inheritancesSoFar = [];
	}

	for (var i in this._namespaces[classname].inherits) {
		var parent = this._namespaces[classname].inherits[i];
		if (inheritancesSoFar.indexOf(parent) === -1) {
			inheritancesSoFar.push(parent);
			inheritancesSoFar = this._flattenInheritances(parent, inheritancesSoFar);
		}
	}

// 	console.log(classname, '→', inheritancesSoFar);
// 	console.log(this._namespaces[classname].inherits);

	return inheritancesSoFar;
};





module.exports = Leafdoc;