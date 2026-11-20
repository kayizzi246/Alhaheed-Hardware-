// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart' hide RepeatMode;
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

// The shared core below is identical in all five screen files, so each
// file carries a few helpers it does not use itself. That is an analyzer
// warning, not an error, and silencing it keeps real warnings visible.
// ignore_for_file: unused_element

import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart'
    show kIsWeb, defaultTargetPlatform, TargetPlatform;
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// ═══════════════════════════════════════════════════════════════
//  WHERE THE API LIVES
//
//  The one line to change when you deploy. Must match the value in
//  al_hadeed_shop.dart, al_hadeed_orders.dart,
//  al_hadeed_company.dart and al_hadeed_manager.dart.
//
//  On a real phone `localhost` means the phone itself, so while testing
//  use the computer's LAN address: http://192.168.1.14:4000
// ═══════════════════════════════════════════════════════════════
const String _apiBase = 'http://localhost:4000';

// Everything from here down to the screen itself is repeated, identically,
// in all five screen files. That is deliberate: FlutterFlow generates
// `custom_code/widgets/index.dart` as a list of
// `export 'al_hadeed_cart.dart' show AlHadeedCart;` lines, so a widget
// class is the only thing that crosses from one custom widget file to
// another. A shared helper is simply not visible, and the build fails
// with "The function '_txt' isn't defined".

// ═══════════════════════════════════════════════════════════════
//  TOKENS — identical in shop, cart, orders, company and manager.
// ═══════════════════════════════════════════════════════════════
const Color _white = Color(0xFFFFFFFF);
const Color _bg = Color(0xFFF4F6F8);
const Color _ink = Color(0xFF102A3F);
const Color _inkSoft = Color(0xFF33475B);
const Color _mid = Color(0xFF6B7A88);
const Color _light = Color(0xFFA3AFB9);
const Color _hairline = Color(0xFFE3E8ED);
const Color _tile = Color(0xFFF7F8FA);
const Color _navy = Color(0xFF14334F);
const Color _navyDark = Color(0xFF0D2439);
const Color _brand = Color(0xFFE98A24);
const Color _brandDark = Color(0xFFC9731A);
const Color _brandPale = Color(0xFFFDF2E4);
const Color _green = Color(0xFF1E8E5A);
const Color _greenPale = Color(0xFFE8F5EE);
const Color _blue = Color(0xFF2D6CA2);
const Color _bluePale = Color(0xFFE8F0F8);
const Color _ember = Color(0xFFC0392B);
const Color _emberPale = Color(0xFFFBECEA);

const Cubic _ease = Cubic(0.23, 1, 0.32, 1);

double _ui = 1.0;

bool get _isApple =>
    !kIsWeb &&
    (defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS);

double _trackingFor(double s) {
  if (s >= 24) return -0.025;
  if (s >= 20) return -0.020;
  if (s >= 17) return -0.013;
  if (s >= 15) return -0.007;
  if (s >= 13) return 0.0;
  return 0.008;
}

TextStyle _font(
  double size, {
  FontWeight weight = FontWeight.w400,
  Color color = _inkSoft,
  double height = 1.3,
}) {
  final s = size * _ui;
  return TextStyle(
    fontFamily: _isApple ? (s >= 20 ? '.SF Pro Display' : '.SF Pro Text') : null,
    fontFamilyFallback: _isApple
        ? const ['.SF UI Display', '.SF UI Text', 'Helvetica Neue']
        : null,
    fontSize: s,
    fontWeight: weight,
    color: color,
    height: height,
    letterSpacing: s * _trackingFor(s),
  );
}

TextStyle _title(double size,
        {FontWeight weight = FontWeight.w700, Color color = _ink}) =>
    _font(size, weight: weight, color: color, height: 1.15);

TextStyle _txt(double size,
        {FontWeight weight = FontWeight.w400,
        Color color = _inkSoft,
        double height = 1.3}) =>
    _font(size, weight: weight, color: color, height: height);

BoxDecoration _liquid({
  Color? tint,
  bool onDark = false,
  double radius = 999,
  bool circle = false,
}) {
  final List<Color> fill;
  final Color rim;
  if (tint != null) {
    fill = [Color.lerp(tint, _white, 0.20)!, tint];
    rim = _white.withOpacity(0.40);
  } else if (onDark) {
    fill = [_white.withOpacity(0.30), _white.withOpacity(0.12)];
    rim = _white.withOpacity(0.42);
  } else {
    fill = const [_white, Color(0xFFEFF2F5)];
    rim = _ink.withOpacity(0.10);
  }
  return BoxDecoration(
    gradient: LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: fill,
    ),
    shape: circle ? BoxShape.circle : BoxShape.rectangle,
    borderRadius: circle ? null : BorderRadius.circular(radius),
    border: Border.all(color: rim, width: 1),
  );
}

class _GradientRim extends BoxBorder {
  const _GradientRim(this.gradient, {this.width = 1});

  final Gradient gradient;
  final double width;

  @override
  BorderSide get top => BorderSide.none;
  @override
  BorderSide get bottom => BorderSide.none;
  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.all(width);
  @override
  bool get isUniform => true;

  @override
  void paint(
    Canvas canvas,
    Rect rect, {
    ui.TextDirection? textDirection,
    BoxShape shape = BoxShape.rectangle,
    BorderRadius? borderRadius,
  }) {
    final paint = Paint()
      ..strokeWidth = width
      ..shader = gradient.createShader(rect)
      ..style = PaintingStyle.stroke;
    final inner = rect.deflate(width / 2);
    if (borderRadius != null) {
      canvas.drawRRect(borderRadius.toRRect(inner), paint);
    } else {
      canvas.drawRect(inner, paint);
    }
  }

  @override
  ShapeBorder scale(double t) => _GradientRim(gradient, width: width * t);
}

class _Glass extends StatelessWidget {
  const _Glass({
    required this.child,
    this.height,
    this.radius = 22,
    this.blur = 24,
    this.padding,
  });

  final Widget child;
  final double? height;
  final double radius;
  final double blur;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          child: Container(
            height: height,
            padding: padding,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(radius),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [_white.withOpacity(0.86), _white.withOpacity(0.66)],
              ),
              border: _GradientRim(
                LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [_white.withOpacity(0.95), _ink.withOpacity(0.12)],
                ),
              ),
            ),
            child: child,
          ),
        ),
      );
}

class _Pressable extends StatefulWidget {
  const _Pressable({required this.child, this.onTap, this.scale = 0.96});

  final Widget child;
  final VoidCallback? onTap;
  final double scale;

  @override
  State<_Pressable> createState() => _PressableState();
}

class _PressableState extends State<_Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v && mounted) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _set(true),
        onTapUp: (_) => _set(false),
        onTapCancel: () => _set(false),
        onTap: widget.onTap == null
            ? null
            : () {
                HapticFeedback.lightImpact();
                widget.onTap!();
              },
        child: AnimatedScale(
          scale: _down ? widget.scale : 1.0,
          duration: Duration(milliseconds: _down ? 100 : 160),
          curve: _ease,
          child: widget.child,
        ),
      );
}

class _Skeleton extends StatefulWidget {
  const _Skeleton(this.width, this.height, {this.radius = 12});

  final double width;
  final double height;
  final double radius;

  @override
  State<_Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<_Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (_, __) => Container(
          width: widget.width == 0 ? null : widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            color: Color.lerp(_tile, _hairline, _c.value),
            borderRadius: BorderRadius.circular(widget.radius),
          ),
        ),
      );
}

/// A text field styled to match the tiles, with no Material underline
/// or outline fighting the flat look.
class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.hint,
    this.validator,
    this.keyboardType,
    this.maxLines = 1,
    this.maxLength,
    this.autofocus = false,
    this.onChanged,
    this.capitalisation = TextCapitalization.none,
  });

  final TextEditingController controller;
  final String hint;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final int maxLines;
  final int? maxLength;
  final bool autofocus;
  final ValueChanged<String>? onChanged;
  final TextCapitalization capitalisation;

  @override
  Widget build(BuildContext context) => TextFormField(
        controller: controller,
        validator: validator,
        keyboardType: keyboardType,
        maxLines: maxLines,
        maxLength: maxLength,
        autofocus: autofocus,
        onChanged: onChanged,
        textCapitalization: capitalisation,
        cursorColor: _brand,
        style: _txt(15, color: _ink),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: _txt(15, color: _light),
          counterText: '',
          filled: true,
          fillColor: _tile,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _hairline),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _hairline),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _brand, width: 1.5),
          ),
          errorStyle: _txt(12, color: _ember),
        ),
      );
}

// ═══════════════════════════════════════════════════════════════
//  THE API
// ═══════════════════════════════════════════════════════════════

class _ApiError implements Exception {
  _ApiError(this.message, {this.unauthorised = false});
  final String message;
  final bool unauthorised;
  @override
  String toString() => message;
}

/// The API answers `{ ...data }` or `{ "error": "in plain words" }`, so a
/// failure arrives with the wording the server wrote — including the
/// spending-limit and out-of-stock messages, which explain themselves far
/// better than a status code would.
Map<String, dynamic> _unwrap(http.Response res) {
  Map<String, dynamic> body;
  try {
    body = jsonDecode(res.body) as Map<String, dynamic>;
  } catch (_) {
    throw _ApiError('The server sent something unexpected. Try again.');
  }

  final error = body['error'];
  if (error != null) {
    throw _ApiError(
      error is String ? error : 'Something went wrong.',
      unauthorised: res.statusCode == 401,
    );
  }
  return body;
}

Map<String, String> _headers({bool json = false}) => {
      'Accept': 'application/json',
      if (json) 'Content-Type': 'application/json',
      if (_Session().token != null)
        'Authorization': 'Bearer ${_Session().token}',
    };

Future<Map<String, dynamic>> _apiGet(String path) async {
  try {
    final res = await http
        .get(Uri.parse(_apiBase).resolve(path), headers: _headers())
        .timeout(const Duration(seconds: 20));
    return _unwrap(res);
  } on _ApiError {
    rethrow;
  } catch (_) {
    throw _ApiError("Can't reach the shop. Check your connection.");
  }
}

Future<Map<String, dynamic>> _apiSend(
    String method, String path, Object body) async {
  try {
    final uri = Uri.parse(_apiBase).resolve(path);
    final headers = _headers(json: true);
    final payload = jsonEncode(body);
    final res = await switch (method) {
      'PATCH' => http.patch(uri, headers: headers, body: payload),
      'DELETE' => http.delete(uri, headers: headers, body: payload),
      _ => http.post(uri, headers: headers, body: payload),
    }
        .timeout(const Duration(seconds: 20));
    return _unwrap(res);
  } on _ApiError {
    rethrow;
  } catch (_) {
    throw _ApiError("Can't reach the shop. Check your connection.");
  }
}

Future<Map<String, dynamic>> _apiPost(String path, Object body) =>
    _apiSend('POST', path, body);

// ═══════════════════════════════════════════════════════════════
//  MONEY
// ═══════════════════════════════════════════════════════════════

String _ugx(int amount) =>
    'UGX ${amount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';

String _shortUgx(int amount) {
  if (amount >= 1000000) {
    final m = amount / 1000000;
    final t = m >= 100 || m == m.roundToDouble()
        ? m.round().toString()
        : m.toStringAsFixed(1);
    return 'UGX ${t}M';
  }
  if (amount >= 1000) return 'UGX ${(amount / 1000).round()}K';
  return 'UGX $amount';
}

/// "09:26" from the API's "2026-11-19 09:26:41".
String _shortTime(String? stamp) {
  if (stamp == null || stamp.length < 16) return '';
  return stamp.substring(11, 16);
}

/// "19 Nov, 09:26" — enough to tell two orders apart without the year
/// taking up half the row.
String _when(String? stamp) {
  if (stamp == null || stamp.length < 16) return '';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final month = int.tryParse(stamp.substring(5, 7)) ?? 1;
  final day = stamp.substring(8, 10);
  return '${int.parse(day)} ${months[month - 1]}, ${stamp.substring(11, 16)}';
}

// ═══════════════════════════════════════════════════════════════
//  WHO IS SIGNED IN
// ═══════════════════════════════════════════════════════════════

/// The signed-in customer, kept on the phone so the app opens straight
/// into the shop rather than asking for a code every time.
class _Session extends ChangeNotifier {
  factory _Session() => _instance;
  _Session._();
  static final _Session _instance = _Session._();

  static const _kToken = 'alhadeed.token';
  static const _kUser = 'alhadeed.user';

  SharedPreferences? _prefs;
  String? token;
  Map<String, dynamic>? user;

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    token = _prefs!.getString(_kToken);
    final raw = _prefs!.getString(_kUser);
    if (raw != null) {
      try {
        user = jsonDecode(raw) as Map<String, dynamic>;
      } catch (_) {
        user = null;
      }
    }
    notifyListeners();
  }

  bool get signedIn => token != null && user != null;
  String get fullName => user?['fullName'] as String? ?? '';
  String get phone => user?['phone'] as String? ?? '';
  String get accountType => user?['accountType'] as String? ?? 'individual';
  bool get isCompany => accountType != 'individual';
  bool get isCompanyOwner => accountType == 'company_owner';
  String? get staffRole => user?['staffRole'] as String?;
  int? get spendingLimit => (user?['spendingLimit'] as num?)?.toInt();
  // The sign-in response carries companyId but not the company's name, so
  // the name is fetched from /auth/me right after signing in and kept
  // alongside it. Both shapes are read here so an older stored session
  // still shows something sensible.
  String get companyName =>
      user?['companyName'] as String? ??
      (user?['company'] as Map<String, dynamic>?)?['company_name']
          as String? ??
      'Company account';

  /// The line under the logo. A company's buyer can see at a glance
  /// whose account an order will land on.
  String get subtitle {
    if (!signedIn) return 'Browse and order — no account needed';
    if (!isCompany) return fullName;
    if (isCompanyOwner) return '$companyName · Owner view';
    return '$companyName · ordering as $fullName'
        '${staffRole == null ? '' : ' ($staffRole)'}';
  }

  Future<void> save(String newToken, Map<String, dynamic> newUser) async {
    _prefs ??= await SharedPreferences.getInstance();
    token = newToken;
    user = newUser;
    await _prefs!.setString(_kToken, newToken);
    await _prefs!.setString(_kUser, jsonEncode(newUser));
    notifyListeners();
  }

  Future<void> signOut() async {
    _prefs ??= await SharedPreferences.getInstance();
    token = null;
    user = null;
    await _prefs!.remove(_kToken);
    await _prefs!.remove(_kUser);
    notifyListeners();
  }
}

// ═══════════════════════════════════════════════════════════════
//  THE CART
// ═══════════════════════════════════════════════════════════════

/// Kept on the phone, not on the server: a cart is a private scribble
/// until it is submitted, and losing it to a dropped connection on the
/// way to the shop would be its own small disaster.
class _CartStore extends ChangeNotifier {
  factory _CartStore() => _instance;
  _CartStore._();
  static final _CartStore _instance = _CartStore._();

  static const _key = 'alhadeed.cart';
  SharedPreferences? _prefs;
  List<Map<String, dynamic>> lines = [];

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    final raw = _prefs!.getString(_key);
    if (raw != null) {
      try {
        lines = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
      } catch (_) {
        lines = [];
      }
    }
    notifyListeners();
  }

  Future<void> _save() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_key, jsonEncode(lines));
    notifyListeners();
  }

  int get count => lines.fold(0, (n, l) => n + (l['quantity'] as int));

  int get subtotal =>
      lines.fold(0, (n, l) => n + (l['price'] as int) * (l['quantity'] as int));

  int quantityOf(int productId) {
    for (final l in lines) {
      if (l['productId'] == productId) return l['quantity'] as int;
    }
    return 0;
  }

  Future<void> add(Map<String, dynamic> product, int quantity) async {
    final id = (product['id'] as num).toInt();
    final existing = lines.indexWhere((l) => l['productId'] == id);
    if (existing >= 0) {
      lines[existing]['quantity'] =
          (lines[existing]['quantity'] as int) + quantity;
    } else {
      lines.add({
        'productId': id,
        'name': product['name'],
        'unit': product['unit'],
        'code': product['code'],
        'category': product['category_name'],
        'price': (product['price'] as num).toInt(),
        'quantity': quantity,
      });
    }
    await _save();
  }

  Future<void> setQuantity(int productId, int quantity) async {
    final i = lines.indexWhere((l) => l['productId'] == productId);
    if (i < 0) return;
    if (quantity <= 0) {
      lines.removeAt(i);
    } else {
      lines[i]['quantity'] = quantity;
    }
    await _save();
  }

  Future<void> clear() async {
    lines = [];
    await _save();
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHARED PIECES
// ═══════════════════════════════════════════════════════════════

/// A colour per category, so cement is always grey-blue and paint is
/// always violet. Hashed from the name rather than hard-coded, because
/// the Manager can add a category on the web panel at any time.
Color _categoryColour(String? name) {
  const palette = [
    Color(0xFF4A6E8A),
    Color(0xFF8A5A3C),
    Color(0xFF3F7F6B),
    Color(0xFF8A6FAE),
    Color(0xFF2F6E9E),
    Color(0xFFB07A2A),
    Color(0xFF5B6E7F),
  ];
  if (name == null || name.isEmpty) return palette[0];
  var h = 0;
  for (final c in name.codeUnits) {
    h = (h * 31 + c) & 0x7FFFFFFF;
  }
  return palette[h % palette.length];
}

/// One colour pair per status, used on every screen, so a chip means the
/// same thing wherever it turns up.
(Color, Color) _statusColours(String status) => switch (status) {
      'pending_payment' => (_brandPale, _brandDark),
      'paid' => (_bluePale, _blue),
      'payment_verified' => (_bluePale, _blue),
      'packed' => (_bluePale, _blue),
      'released' => (_greenPale, _green),
      'cancelled' => (_emberPale, _ember),
      'rejected' => (_emberPale, _ember),
      _ => (_tile, _mid),
    };

String _statusLabel(String status) => switch (status) {
      'pending_payment' => 'Pending payment',
      'paid' => 'Paid',
      'payment_verified' => 'Verifying',
      'packed' => 'Being packed',
      'released' => 'Completed',
      'cancelled' => 'Cancelled',
      'rejected' => 'Payment rejected',
      _ => status,
    };

class _Chip extends StatelessWidget {
  const _Chip(this.label,
      {required this.bg, required this.fg, this.bold = true});

  final String label;
  final Color bg;
  final Color fg;
  final bool bold;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: _txt(11.5,
              weight: bold ? FontWeight.w700 : FontWeight.w500, color: fg),
        ),
      );
}

/// The bottom bar. Four screens, and everything else the app does is a
/// sheet that slides over whichever one you are on — so you never lose
/// your place to look something up.
///
/// The other three screens are reached by their widget class, which is
/// the only thing FlutterFlow lets cross between custom widget files.
class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.current});

  /// 'shop' | 'cart' | 'orders' | 'company'
  final String current;

  void _go(BuildContext context, Widget page) =>
      Navigator.of(context).pushReplacement(PageRouteBuilder(
        pageBuilder: (_, __, ___) => page,
        transitionDuration: Duration.zero,
        reverseTransitionDuration: Duration.zero,
      ));

  @override
  Widget build(BuildContext context) {
    final owner = _Session().isCompanyOwner;
    final items = <(String, String, IconData, Widget)>[
      ('shop', 'Shop', Icons.storefront_outlined, const AlHadeedShop()),
      ('cart', 'Cart', Icons.shopping_cart_outlined, const AlHadeedCart()),
      ('orders', 'Orders', Icons.receipt_long_outlined, const AlHadeedOrders()),
      (
        'company',
        owner ? 'Company' : 'Account',
        owner ? Icons.business_outlined : Icons.person_outline_rounded,
        const AlHadeedCompany()
      ),
    ];

    return Container(
      decoration: const BoxDecoration(
        color: _white,
        border: Border(top: BorderSide(color: _hairline)),
      ),
      padding: EdgeInsets.only(
          top: 8, bottom: MediaQuery.paddingOf(context).bottom + 8),
      child: Row(
        children: [
          for (final (key, label, icon, page) in items)
            Expanded(
              child: _Pressable(
                scale: 0.92,
                onTap: key == current ? null : () => _go(context, page),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Icon(icon,
                            size: 22, color: key == current ? _brand : _light),
                        if (key == 'cart')
                          ListenableBuilder(
                            listenable: _CartStore(),
                            builder: (_, __) {
                              final n = _CartStore().count;
                              if (n == 0) return const SizedBox.shrink();
                              return Positioned(
                                right: -8,
                                top: -5,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 5, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: _brand,
                                    borderRadius: BorderRadius.circular(9),
                                  ),
                                  constraints:
                                      const BoxConstraints(minWidth: 17),
                                  child: Text('$n',
                                      textAlign: TextAlign.center,
                                      style: _txt(10.5,
                                          weight: FontWeight.w700,
                                          color: _white)),
                                ),
                              );
                            },
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(label,
                        style: _txt(10.5,
                            weight: key == current
                                ? FontWeight.w700
                                : FontWeight.w500,
                            color: key == current ? _brand : _light)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The navy header every screen wears.
class _Header extends StatelessWidget {
  const _Header({required this.subtitle, this.trailing});

  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: EdgeInsets.fromLTRB(
            18, MediaQuery.paddingOf(context).top + 12, 12, 14),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_navy, _navyDark],
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text('AL HADEED ',
                          style: _title(16.5,
                              weight: FontWeight.w800, color: _white)),
                      Text('HARDWARE',
                          style: _title(16.5,
                              weight: FontWeight.w800, color: _brand)),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _txt(12, color: _white.withOpacity(0.75))),
                ],
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
      );
}

/// Every screen's "nothing here yet" and "that did not work" state.
class _Empty extends StatelessWidget {
  const _Empty({
    required this.icon,
    required this.title,
    required this.line,
    this.action,
    this.onAction,
    this.tone = _mid,
  });

  final IconData icon;
  final String title;
  final String line;
  final String? action;
  final VoidCallback? onAction;
  final Color tone;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                    color: tone == _ember ? _emberPale : _tile,
                    shape: BoxShape.circle),
                child: Icon(icon, size: 32, color: tone),
              ),
              const SizedBox(height: 16),
              Text(title, textAlign: TextAlign.center, style: _title(19)),
              const SizedBox(height: 8),
              Text(line,
                  textAlign: TextAlign.center,
                  style: _txt(13.5, color: _mid, height: 1.5)),
              if (action != null) ...[
                const SizedBox(height: 20),
                _Pressable(
                  scale: 0.98,
                  onTap: onAction,
                  child: Container(
                    height: 46,
                    padding: const EdgeInsets.symmetric(horizontal: 22),
                    alignment: Alignment.center,
                    decoration: _liquid(tint: _brand, radius: 23),
                    child: Text(action!,
                        style:
                            _txt(15, weight: FontWeight.w600, color: _white)),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
}

/// The shell every sheet in the app sits in: grab handle, rounded top,
/// lifted clear of the keyboard.
class _Sheet extends StatelessWidget {
  const _Sheet({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    _ui = (mq.size.width / 390).clamp(0.86, 1.08);
    return Padding(
      // Lifts the sheet above the keyboard, or the submit button sits
      // under it and cannot be reached.
      padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
        ),
        clipBehavior: Clip.antiAlias,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(top: 10, bottom: 8),
                decoration: BoxDecoration(
                  color: _hairline,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

void _toast(BuildContext context, String message, {bool bad = false}) =>
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: bad ? _ember : _ink,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        content: Text(message, style: _txt(13.5, color: _white)),
      ),
    );

// ═══════════════════════════════════════════════════════════════
//  WHAT WE KNOW ABOUT THE PERSON ORDERING
// ═══════════════════════════════════════════════════════════════

/// Phone, name and where things go, kept on the phone between orders.
///
/// A builder ordering twice in a week should not type their site address
/// out a second time. None of this is a login — it is the till-roll
/// details the shop would otherwise ask for over the counter.
class _Details extends ChangeNotifier {
  factory _Details() => _instance;
  _Details._();
  static final _Details _instance = _Details._();

  static const _key = 'alhadeed.details';
  SharedPreferences? _prefs;

  String phone = '';
  String fullName = '';
  String location = '';

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    try {
      final raw = _prefs!.getString(_key);
      if (raw != null) {
        final m = jsonDecode(raw) as Map<String, dynamic>;
        phone = m['phone'] as String? ?? '';
        fullName = m['fullName'] as String? ?? '';
        location = m['location'] as String? ?? '';
      }
    } catch (_) {
      // Corrupt storage just starts blank.
    }

    // A signed-in customer's own details beat anything typed before.
    final s = _Session();
    if (s.signedIn) {
      if (s.phone.isNotEmpty) phone = s.phone;
      if (s.fullName.isNotEmpty) fullName = s.fullName;
    }
    notifyListeners();
  }

  Future<void> save({String? phone, String? fullName, String? location}) async {
    _prefs ??= await SharedPreferences.getInstance();
    if (phone != null) this.phone = phone;
    if (fullName != null) this.fullName = fullName;
    if (location != null) this.location = location;
    await _prefs!.setString(
        _key,
        jsonEncode({
          'phone': this.phone,
          'fullName': this.fullName,
          'location': this.location,
        }));
    notifyListeners();
  }
}

// ═══════════════════════════════════════════════════════════════
//  SCREEN 2 OF 4 — THE FINAL PAGE
// ═══════════════════════════════════════════════════════════════

/// Everything between "I want this" and "the shop has it".
///
/// The order is read back, the name and number are confirmed, how the
/// goods travel is chosen, and where they are going is written down.
/// Then one button. No money moves here — it is paid at the cashier's
/// desk — so the wording never promises a purchase.
class AlHadeedCart extends StatefulWidget {
  const AlHadeedCart({super.key, this.width, this.height});

  /// FlutterFlow fills these in from the canvas when "Width and Height"
  /// is switched on. They are not something to wire up, but the
  /// constructor has to accept them or saving fails with:
  /// Parameter "width" not found.
  final double? width;
  final double? height;

  @override
  State<AlHadeedCart> createState() => _AlHadeedCartState();
}

class _AlHadeedCartState extends State<AlHadeedCart> {
  final _name = TextEditingController();
  final _location = TextEditingController();

  /// 'shop_delivery' | 'own_transport' | 'pickup'
  String _delivery = 'shop_delivery';

  bool _ready = false;
  bool _placing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  @override
  void dispose() {
    _name.dispose();
    _location.dispose();
    super.dispose();
  }

  Future<void> _boot() async {
    await _Session().load();
    await _CartStore().load();
    await _Details().load();
    if (!mounted) return;

    _name.text = _Details().fullName;
    _location.text = _Details().location;
    setState(() => _ready = true);

    // The number is the first thing asked for, and only once there is
    // something to order. After the frame, or there is no Navigator yet.
    if (_Details().phone.isEmpty && _CartStore().lines.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _askPhone());
    }
  }

  Future<void> _askPhone() => showModalBottomSheet<String>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => _PhoneSheet(phone: _Details().phone),
      ).then((phone) async {
        if (phone == null || phone.trim().isEmpty) return;
        await _Details().save(phone: phone.trim());
        if (mounted) setState(() {});
      });

  bool get _needsLocation => _delivery == 'shop_delivery';

  bool get _canPlace =>
      _CartStore().lines.isNotEmpty &&
      !_placing &&
      _Details().phone.trim().length >= 9 &&
      _name.text.trim().length >= 2 &&
      (!_needsLocation || _location.text.trim().isNotEmpty) &&
      !_overLimit;

  /// A company's staff member can be given a ceiling per order. The
  /// server enforces it; this is only so the ceiling is visible *before*
  /// the order is refused.
  bool get _overLimit {
    final limit = _Session().spendingLimit;
    return limit != null && _CartStore().subtotal > limit;
  }

  Future<void> _place() async {
    setState(() {
      _placing = true;
      _error = null;
    });

    final items = [
      for (final l in _CartStore().lines)
        {'productId': l['productId'], 'quantity': l['quantity']},
    ];

    try {
      Map<String, dynamic> order;
      bool smsSent = true;

      if (_Session().signedIn) {
        // An account we already know: the order is filed against it, and
        // a company's spending rules apply as usual.
        final r = await _apiPost('/api/orders', {
          'items': items,
          'fulfilment': _delivery == 'shop_delivery' ? 'delivery' : 'pickup',
          if (_delivery == 'shop_delivery')
            'deliveryAddress': _location.text.trim(),
          'notes': _deliveryNote(),
        });
        order = (r['order'] as Map).cast<String, dynamic>();
      } else {
        // No account. The phone number is the account: the shop creates
        // one against it, and the confirmation SMS goes to that number.
        final r = await _apiPost('/api/orders/guest', {
          'phone': _Details().phone.trim(),
          'fullName': _name.text.trim(),
          'items': items,
          'delivery': _delivery,
          'location': _location.text.trim(),
        });
        order = (r['order'] as Map).cast<String, dynamic>();
        smsSent = r['smsSent'] != false;

        // The order was placed from this device, so this device keeps
        // the session — the order is in the history straight away.
        if (r['token'] != null && r['user'] != null) {
          await _Session().save(
              r['token'] as String, (r['user'] as Map).cast<String, dynamic>());
        }
      }

      await _Details().save(
        fullName: _name.text.trim(),
        location: _location.text.trim(),
      );
      await _CartStore().clear();
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      setState(() => _placing = false);

      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        isDismissible: false,
        enableDrag: false,
        backgroundColor: Colors.transparent,
        builder: (_) =>
            _OrderPlacedSheet(order: order, smsSent: smsSent, phone: _Details().phone),
      );
    } on _ApiError catch (e) {
      if (!mounted) return;
      // The server's wording is better than anything invented here:
      // "Only 8 length of Iron Bar Y12 left in stock" says exactly what
      // to do next.
      setState(() {
        _error = e.message;
        _placing = false;
      });
    }
  }

  String _deliveryNote() => switch (_delivery) {
        'own_transport' =>
          "Collected from the shop by the customer's own delivery man"
              "${_location.text.trim().isEmpty ? '' : ' — going to ${_location.text.trim()}'}",
        'pickup' => 'Customer is collecting from the shop',
        _ => 'Shop delivery — free',
      };

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    _ui = (mq.size.width / 390).clamp(0.86, 1.08);

    return MediaQuery(
      data: mq.copyWith(
        textScaler:
            mq.textScaler.clamp(minScaleFactor: 0.9, maxScaleFactor: 1.2),
      ),
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light
            .copyWith(statusBarColor: Colors.transparent),
        child: Container(
          width: widget.width ?? mq.size.width,
          height: widget.height ?? mq.size.height,
          color: _bg,
          child: Scaffold(
            backgroundColor: _bg,
            body: ListenableBuilder(
              listenable: Listenable.merge([_CartStore(), _Details()]),
              builder: (_, __) => Column(
                children: [
                  _Header(
                    subtitle: _CartStore().lines.isEmpty
                        ? 'Your order'
                        : 'Check it over, then order',
                    trailing: _CartStore().lines.isEmpty
                        ? null
                        : _Pressable(
                            scale: 0.9,
                            onTap: _confirmClear,
                            child: Container(
                              width: 38,
                              height: 38,
                              decoration: _liquid(circle: true, onDark: true),
                              child: const Icon(Icons.delete_outline_rounded,
                                  size: 19, color: _white),
                            ),
                          ),
                  ),
                  Expanded(child: _body()),
                ],
              ),
            ),
            bottomNavigationBar: const _BottomBar(current: 'cart'),
          ),
        ),
      ),
    );
  }

  Future<void> _confirmClear() => showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => const _ConfirmSheet(
          icon: Icons.delete_outline_rounded,
          title: 'Clear this order?',
          line: 'Everything in it will be removed. The products stay in '
              'the shop, so you can add them again.',
          confirm: 'Clear it',
        ),
      ).then((yes) async {
        if (yes != true) return;
        await _CartStore().clear();
        if (mounted) setState(() {});
      });

  Widget _body() {
    if (!_ready) return const Center(child: CircularProgressIndicator(color: _brand));

    if (_CartStore().lines.isEmpty) {
      return _Empty(
        icon: Icons.shopping_basket_outlined,
        title: 'Nothing to order yet',
        line: 'Pick what you need from the shop and it will be listed '
            'here, ready to order.',
        action: 'Go to the shop',
        onAction: () => Navigator.of(context).pushReplacement(
          PageRouteBuilder(
            pageBuilder: (_, __, ___) => const AlHadeedShop(),
            transitionDuration: Duration.zero,
          ),
        ),
      );
    }

    return Column(
      children: [
        Expanded(
          child: ListView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            children: [
              _label('YOUR ORDER (${_CartStore().lines.length} ITEMS)'),
              const SizedBox(height: 10),
              for (final line in _CartStore().lines) _cartLine(line),

              const SizedBox(height: 20),
              _label('WHO IS ORDERING'),
              const SizedBox(height: 10),
              _phoneRow(),
              const SizedBox(height: 10),
              _Field(
                controller: _name,
                hint: 'Your name',
                capitalisation: TextCapitalization.words,
                onChanged: (_) => setState(() {}),
              ),

              const SizedBox(height: 20),
              _label('HOW IT GETS TO YOU'),
              const SizedBox(height: 10),
              _deliveryOption(
                value: 'shop_delivery',
                icon: Icons.local_shipping_outlined,
                title: 'We deliver it',
                line: 'Our truck brings it to you. Free of charge.',
              ),
              _deliveryOption(
                value: 'own_transport',
                icon: Icons.two_wheeler_outlined,
                title: 'My own delivery man collects it',
                line: 'Your boda or truck picks it up at the shop.',
              ),
              _deliveryOption(
                value: 'pickup',
                icon: Icons.storefront_outlined,
                title: 'I will collect it myself',
                line: 'Come to the counter with your order number.',
              ),

              const SizedBox(height: 16),
              _label(_needsLocation
                  ? 'WHERE TO DELIVER'
                  : 'WHERE IT IS GOING (OPTIONAL)'),
              const SizedBox(height: 10),
              _Field(
                controller: _location,
                hint: 'Plot 24, Bukoto · behind the fuel station',
                maxLines: 2,
                capitalisation: TextCapitalization.sentences,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 6),
              Text(
                _needsLocation
                    ? 'A plot number and a landmark beat a road name — the '
                        'driver will call you on arrival.'
                    : 'Only so the shop knows where the goods are headed.',
                style: _txt(12, color: _light, height: 1.45),
              ),

              const SizedBox(height: 20),
              _totals(),

              if (_overLimit) ...[
                const SizedBox(height: 12),
                _notice(
                  icon: Icons.account_balance_wallet_outlined,
                  tone: _ember,
                  bg: _emberPale,
                  text: 'This is over your spending limit of '
                      '${_ugx(_Session().spendingLimit!)} per order. Remove '
                      'something, or ask the company owner to raise it.',
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                _notice(
                    icon: Icons.error_outline_rounded,
                    tone: _ember,
                    bg: _emberPale,
                    text: _error!),
              ],
              const SizedBox(height: 10),
            ],
          ),
        ),
        _placeBar(),
      ],
    );
  }

  Widget _label(String text) =>
      Text(text, style: _txt(11.5, weight: FontWeight.w700, color: _light));

  /// The number is tapped to change, not typed over: it is the one field
  /// that decides whose order this is, and the SMS goes to it.
  Widget _phoneRow() => _Pressable(
        scale: 0.99,
        onTap: _askPhone,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: _white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
                color: _Details().phone.isEmpty ? _brand : _hairline),
          ),
          child: Row(
            children: [
              Icon(Icons.phone_iphone_rounded,
                  size: 19,
                  color: _Details().phone.isEmpty ? _brand : _mid),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _Details().phone.isEmpty
                          ? 'Add your phone number'
                          : _Details().phone,
                      style: _txt(14.5,
                          weight: FontWeight.w600,
                          color: _Details().phone.isEmpty ? _brand : _ink),
                    ),
                    const SizedBox(height: 2),
                    Text('We text your order number here',
                        style: _txt(12, color: _mid)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, size: 20, color: _light),
            ],
          ),
        ),
      );

  Widget _deliveryOption({
    required String value,
    required IconData icon,
    required String title,
    required String line,
  }) {
    final on = _delivery == value;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: _Pressable(
        scale: 0.99,
        onTap: () => setState(() => _delivery = value),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: on ? _brandPale : _white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: on ? _brand : _hairline),
          ),
          child: Row(
            children: [
              Icon(icon, size: 21, color: on ? _brandDark : _mid),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: _txt(14,
                            weight: FontWeight.w600,
                            color: on ? _brandDark : _ink)),
                    const SizedBox(height: 2),
                    Text(line, style: _txt(12, color: _mid, height: 1.35)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: on ? _brand : _white,
                  border: Border.all(color: on ? _brand : _hairline, width: 2),
                ),
                child: on
                    ? const Icon(Icons.check_rounded, size: 12, color: _white)
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _cartLine(Map<String, dynamic> line) {
    final id = line['productId'] as int;
    final price = line['price'] as int;
    final qty = line['quantity'] as int;
    final colour = _categoryColour(line['category'] as String?);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _hairline),
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: colour,
              borderRadius: BorderRadius.circular(11),
            ),
            alignment: Alignment.center,
            child: Text(
              (line['category'] as String? ?? '?').characters.first.toUpperCase(),
              style: _title(18, weight: FontWeight.w800, color: _white),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(line['name'] as String? ?? '',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: _txt(14, weight: FontWeight.w600, color: _ink)),
                const SizedBox(height: 2),
                Text('${_ugx(price)} · per ${line['unit'] ?? 'unit'}',
                    style: _txt(12, color: _mid)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _step(Icons.remove_rounded,
                        onTap: () => _CartStore().setQuantity(id, qty - 1)),
                    SizedBox(
                      width: 42,
                      child: Text('$qty',
                          textAlign: TextAlign.center,
                          style: _title(15.5, weight: FontWeight.w700)),
                    ),
                    _step(Icons.add_rounded,
                        onTap: () => _CartStore().setQuantity(id, qty + 1)),
                    const Spacer(),
                    Text(_ugx(price * qty),
                        style: _title(15, weight: FontWeight.w800)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _step(IconData icon, {required VoidCallback onTap}) => _Pressable(
        scale: 0.84,
        onTap: onTap,
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: _white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: _hairline),
          ),
          child: Icon(icon, size: 16, color: _ink),
        ),
      );

  Widget _totals() {
    final subtotal = _CartStore().subtotal;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _hairline),
      ),
      child: Column(
        children: [
          _totalRow('Goods', _ugx(subtotal)),
          const SizedBox(height: 9),
          _totalRow(
            'Delivery',
            _delivery == 'shop_delivery' ? 'Free' : 'Collected',
            muted: _delivery != 'shop_delivery',
            good: _delivery == 'shop_delivery',
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1, thickness: 1, color: _hairline),
          ),
          Row(
            children: [
              Text('To pay at the cashier', style: _title(15)),
              const Spacer(),
              Text(_ugx(subtotal), style: _title(20, weight: FontWeight.w800)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _totalRow(String k, String v, {bool muted = false, bool good = false}) =>
      Row(
        children: [
          Text(k, style: _txt(13.5, color: _inkSoft)),
          const Spacer(),
          Text(v,
              style: _txt(13.5,
                  weight: muted ? FontWeight.w500 : FontWeight.w700,
                  color: good ? _green : (muted ? _mid : _ink))),
        ],
      );

  Widget _notice({
    required IconData icon,
    required Color tone,
    required Color bg,
    required String text,
  }) =>
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: tone),
            const SizedBox(width: 10),
            Expanded(
              child: Text(text, style: _txt(13, color: _inkSoft, height: 1.45)),
            ),
          ],
        ),
      );

  /// The order button floats rather than sitting at the end of the
  /// scroll. A call to action you have to reach is one most people never
  /// reach, and on this screen it is the whole point.
  Widget _placeBar() => Padding(
        padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
        child: _Glass(
          height: 66,
          radius: 33,
          blur: 26,
          padding: const EdgeInsets.fromLTRB(20, 0, 7, 0),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_ugx(_CartStore().subtotal),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: _title(18, weight: FontWeight.w800)),
                    Text(
                      _canPlace
                          ? '${_CartStore().count} items · pay at the cashier'
                          : _whatIsMissing(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _txt(11.5,
                          color: _canPlace ? _mid : _brandDark,
                          weight: _canPlace
                              ? FontWeight.w400
                              : FontWeight.w600),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _Pressable(
                scale: 0.98,
                onTap: _canPlace ? _place : null,
                child: Container(
                  height: 52,
                  padding: const EdgeInsets.symmetric(horizontal: 22),
                  alignment: Alignment.center,
                  decoration: _canPlace
                      ? _liquid(tint: _brand, radius: 26)
                      : BoxDecoration(
                          color: _tile,
                          borderRadius: BorderRadius.circular(26),
                          border: Border.all(color: _hairline),
                        ),
                  child: _placing
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: _white),
                        )
                      : Text('Place order',
                          style: _txt(15,
                              weight: FontWeight.w600,
                              color: _canPlace ? _white : _light)),
                ),
              ),
            ],
          ),
        ),
      );

  /// A disabled button with no explanation is a dead end. This says
  /// which field is still empty.
  String _whatIsMissing() {
    if (_overLimit) return 'Over your spending limit';
    if (_Details().phone.trim().length < 9) return 'Add your phone number';
    if (_name.text.trim().length < 2) return 'Add your name';
    if (_needsLocation && _location.text.trim().isEmpty) {
      return 'Say where to deliver';
    }
    return '${_CartStore().count} items';
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHEET — THE PHONE NUMBER
// ═══════════════════════════════════════════════════════════════

/// The one thing the shop needs before it can take an order.
///
/// No code to wait for and nothing to verify: the number is where the
/// confirmation SMS goes, and it is what the order is filed under. Pops
/// the number.
class _PhoneSheet extends StatefulWidget {
  const _PhoneSheet({required this.phone});

  final String phone;

  @override
  State<_PhoneSheet> createState() => _PhoneSheetState();
}

class _PhoneSheetState extends State<_PhoneSheet> {
  final _formKey = GlobalKey<FormState>();
  late final _controller = TextEditingController(text: widget.phone);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Ugandan numbers are 10 digits as people write them (0772 123 456),
  /// 9 without the leading zero, 12 with the country code. Nine is the
  /// shortest thing that could be real.
  String? _validate(String? v) =>
      (v == null || v.replaceAll(RegExp(r'[^0-9]'), '').length < 9)
          ? 'The shop needs a number to reach you on.'
          : null;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: const BoxDecoration(
                    color: _brandPale, shape: BoxShape.circle),
                child: const Icon(Icons.phone_iphone_rounded,
                    size: 24, color: _brandDark),
              ),
              const SizedBox(height: 14),
              Text('Your phone number', style: _title(21)),
              const SizedBox(height: 6),
              Text(
                'We text your order number to this phone, and the shop '
                'calls it if there is any question about the order.',
                style: _txt(13, color: _mid, height: 1.45),
              ),
              const SizedBox(height: 18),
              _Field(
                controller: _controller,
                hint: '0772 123 456',
                keyboardType: TextInputType.phone,
                autofocus: true,
                validator: _validate,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 18),
              _Pressable(
                scale: 0.98,
                onTap: () {
                  if (!_formKey.currentState!.validate()) return;
                  Navigator.of(context).pop(_controller.text.trim());
                },
                child: Container(
                  height: 52,
                  width: double.infinity,
                  alignment: Alignment.center,
                  decoration: _liquid(tint: _brand, radius: 26),
                  child: Text('Continue',
                      style:
                          _txt(15, weight: FontWeight.w600, color: _white)),
                ),
              ),
              SizedBox(height: mq.padding.bottom + 4),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHEET — ORDER PLACED
// ═══════════════════════════════════════════════════════════════

/// What happens next, in the order it happens, with the order number big
/// enough to read out over the phone — and confirmation that the text
/// has gone, since that message is what the counter will ask for.
class _OrderPlacedSheet extends StatelessWidget {
  const _OrderPlacedSheet({
    required this.order,
    required this.smsSent,
    required this.phone,
  });

  final Map<String, dynamic> order;
  final bool smsSent;
  final String phone;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                    color: _greenPale, shape: BoxShape.circle),
                child: const Icon(Icons.check_rounded, size: 34, color: _green),
              ),
            ),
            const SizedBox(height: 16),
            Center(child: Text('Order placed', style: _title(22))),
            const SizedBox(height: 6),
            Center(
              child: Text('#${order['order_no'] ?? ''}',
                  style:
                      _title(19, weight: FontWeight.w800, color: _brandDark)),
            ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: smsSent ? _greenPale : _brandPale,
                borderRadius: BorderRadius.circular(13),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                      smsSent
                          ? Icons.sms_outlined
                          : Icons.sms_failed_outlined,
                      size: 18,
                      color: smsSent ? _green : _brandDark),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      smsSent
                          ? 'We texted the order number to $phone.'
                          : 'The text could not be sent just now — your '
                              'order is safe, and the number is above.',
                      style: _txt(12.5,
                          color: smsSent ? _green : _brandDark, height: 1.45),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _tile,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Text('To pay at the cashier',
                          style: _txt(13.5, color: _inkSoft)),
                      const Spacer(),
                      Text(_ugx((order['total'] as num?)?.toInt() ?? 0),
                          style: _title(17, weight: FontWeight.w800)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Divider(height: 1, thickness: 1, color: _hairline),
                  const SizedBox(height: 12),
                  _step(1, 'Pay at the cashier',
                      'Cash, mobile money or card. Quote your order number.'),
                  _step(2, 'Accounts verify the payment',
                      'Usually a minute or two.'),
                  _step(
                      3,
                      order['fulfilment'] == 'delivery'
                          ? 'We load it and deliver'
                          : 'Store packs it for collection',
                      'You will be told when it is ready.',
                      last: true),
                ],
              ),
            ),
            const SizedBox(height: 18),
            _Pressable(
              scale: 0.98,
              onTap: () {
                Navigator.of(context).pop();
                Navigator.of(context).pushReplacement(PageRouteBuilder(
                  pageBuilder: (_, __, ___) => const AlHadeedOrders(),
                  transitionDuration: Duration.zero,
                ));
              },
              child: Container(
                height: 52,
                width: double.infinity,
                alignment: Alignment.center,
                decoration: _liquid(tint: _brand, radius: 26),
                child: Text('See it in my orders',
                    style: _txt(15, weight: FontWeight.w600, color: _white)),
              ),
            ),
            const SizedBox(height: 6),
            Center(
              child: TextButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  Navigator.of(context).pushReplacement(PageRouteBuilder(
                    pageBuilder: (_, __, ___) => const AlHadeedShop(),
                    transitionDuration: Duration.zero,
                  ));
                },
                child: Text('Back to the shop',
                    style:
                        _txt(13.5, weight: FontWeight.w600, color: _brandDark)),
              ),
            ),
            SizedBox(height: mq.padding.bottom + 4),
          ],
        ),
      ),
    );
  }

  Widget _step(int n, String title, String line, {bool last = false}) =>
      Padding(
        padding: EdgeInsets.only(bottom: last ? 0 : 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 22,
              height: 22,
              decoration:
                  const BoxDecoration(color: _white, shape: BoxShape.circle),
              alignment: Alignment.center,
              child: Text('$n',
                  style:
                      _txt(11.5, weight: FontWeight.w800, color: _brandDark)),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: _txt(13.5, weight: FontWeight.w600, color: _ink)),
                  const SizedBox(height: 1),
                  Text(line, style: _txt(12, color: _mid, height: 1.4)),
                ],
              ),
            ),
          ],
        ),
      );
}

// ═══════════════════════════════════════════════════════════════
//  SHEET — ARE YOU SURE
// ═══════════════════════════════════════════════════════════════

/// One sheet for every "are you sure", so a destructive answer always
/// looks and reads the same way. Pops `true` when confirmed.
class _ConfirmSheet extends StatelessWidget {
  const _ConfirmSheet({
    required this.icon,
    required this.title,
    required this.line,
    required this.confirm,
  });

  final IconData icon;
  final String title;
  final String line;
  final String confirm;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: const BoxDecoration(
                  color: _emberPale, shape: BoxShape.circle),
              child: Icon(icon, size: 26, color: _ember),
            ),
            const SizedBox(height: 14),
            Text(title, style: _title(20)),
            const SizedBox(height: 6),
            Text(line, style: _txt(13.5, color: _mid, height: 1.5)),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _Pressable(
                    scale: 0.98,
                    onTap: () => Navigator.of(context).pop(false),
                    child: Container(
                      height: 50,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _tile,
                        borderRadius: BorderRadius.circular(25),
                        border: Border.all(color: _hairline),
                      ),
                      child: Text('Keep it',
                          style: _txt(14.5,
                              weight: FontWeight.w600, color: _inkSoft)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _Pressable(
                    scale: 0.98,
                    onTap: () => Navigator.of(context).pop(true),
                    child: Container(
                      height: 50,
                      alignment: Alignment.center,
                      decoration: _liquid(tint: _ember, radius: 25),
                      child: Text(confirm,
                          style: _txt(14.5,
                              weight: FontWeight.w600, color: _white)),
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: mq.padding.bottom + 4),
          ],
        ),
      ),
    );
  }
}
