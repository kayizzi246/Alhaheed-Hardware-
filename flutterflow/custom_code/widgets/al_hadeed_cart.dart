// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart' hide RepeatMode;
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

// ╔═══════════════════════════════════════════════════════════════╗
// ║  NAME THIS CUSTOM WIDGET:   AlHadeedCart                      ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// FlutterFlow looks for a class with exactly the name typed in the
// "Custom Widget" box. The default is "NewCustomWidget", and leaving
// it there is what produces:
//
//     No widget "NewCustomWidget" found.
//
// So set the name field to:
//
//     AlHadeedCart
//
// Spelling and capitals both matter. Then switch on "Width and Height
// (required)" — this widget already accepts them — and Save.
//
// The basket, the phone number and placing the order.


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
const String _apiBase = 'https://pearlfx.online';

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
const Color _bg = Color(0xFFF5F7FB);
const Color _ink = Color(0xFF0F1B33);
const Color _inkSoft = Color(0xFF394862);
const Color _mid = Color(0xFF55637D);
const Color _light = Color(0xFF626F88);
const Color _hairline = Color(0xFFE2E8F2);
const Color _tile = Color(0xFFF9FAFD);
const Color _navy = Color(0xFF0E201A);
const Color _navyDark = Color(0xFF081511);
// #92D050 is the shop's green. It is light, so what sits on it is dark
// (_onLime); green words and marks on white use the deeper _brand.
const Color _lime = Color(0xFF92D050);
const Color _onLime = Color(0xFF102108);
const Color _brand = Color(0xFF3F7A12);
const Color _brandDark = Color(0xFF2F5E0C);
const Color _brandPale = Color(0xFFF0F8E6);
const Color _green = Color(0xFF0E7444);
const Color _greenPale = Color(0xFFE6F6ED);
const Color _blue = Color(0xFF0B658D);
const Color _bluePale = Color(0xFFE3F3FB);
const Color _amber = Color(0xFF9A5205);
const Color _amberPale = Color(0xFFFEF3E0);
const Color _ember = Color(0xFFC02B2B);
const Color _emberPale = Color(0xFFFDECEC);

const Cubic _ease = Cubic(0.23, 1, 0.32, 1);

/// Soft depth for cards: a tight contact shadow and a wide faint one —
/// the same layered shadow the staff panel's cards use.
const List<BoxShadow> _cardShadow = [];

/// The brand's blue, deepening — hero cards, the header, the add button.
const LinearGradient _heroGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [_lime, _lime],
);

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
  final s = size * _ui * 0.92; // one size step smaller everywhere
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
    fill = [tint, tint];
    rim = _white.withOpacity(0.40);
  } else if (onDark) {
    fill = [_white.withOpacity(0.16), _white.withOpacity(0.16)];
    rim = _white.withOpacity(0.42);
  } else {
    fill = const [_white, _white];
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
                colors: [_white, _white],
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
    super.key,
    required this.controller,
    this.obscure = false,
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
  final bool obscure;
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
        obscureText: obscure,
        autocorrect: !obscure,
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
              const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
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
  _ApiError(this.message, {this.unauthorised = false, this.code});
  final String message;
  final String? code;
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
      code: body['code']?.toString(),
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
    } else {
      user = null;
    }
    notifyListeners();
  }

  bool get signedIn => token != null && user != null;

  /// 'customer', or the desk: 'store' | 'cashier' | 'accounts' | 'manager'.
  String get role => user?['role'] as String? ?? 'customer';
  bool get isStaff => signedIn && role != 'customer';
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
    if (!signedIn) return 'Browse the shop, sign in to order';
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
      'pending_payment' => (_amberPale, _amber),
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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
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
    // Outline when idle, filled where you are.
    final items = <(String, String, IconData, IconData, Widget)>[
      ('shop', 'Shop', Icons.storefront_outlined, Icons.storefront_rounded,
          const AlHadeedShop()),
      ('cart', 'Cart', Icons.shopping_cart_outlined,
          Icons.shopping_cart_rounded, const AlHadeedCart()),
      ('orders', 'Orders', Icons.receipt_long_outlined,
          Icons.receipt_long_rounded, const AlHadeedOrders()),
      (
        'company',
        owner ? 'Company' : 'Account',
        owner ? Icons.business_outlined : Icons.person_outline_rounded,
        owner ? Icons.business_rounded : Icons.person_rounded,
        const AlHadeedCompany()
      ),
    ];

    // A floating bar rather than a slab across the bottom: it sits on
    // the page, and the tab you are on is lit by a soft pill.
    return Padding(
      padding: EdgeInsets.fromLTRB(
          16, 6, 16, MediaQuery.paddingOf(context).bottom + 10),
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: _hairline),
        ),
        child: Row(
          children: [
            for (final (key, label, icon, iconOn, page) in items)
              Expanded(
                child: _Pressable(
                  scale: 0.94,
                  onTap: key == current ? null : () => _go(context, page),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    curve: _ease,
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    decoration: BoxDecoration(
                      color:
                          key == current ? _brandPale : _white.withOpacity(0),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Icon(key == current ? iconOn : icon,
                                size: 21,
                                color: key == current ? _brand : _light),
                            if (key == 'cart')
                              ListenableBuilder(
                                listenable: _CartStore(),
                                builder: (_, __) {
                                  final n = _CartStore().count;
                                  if (n == 0) return const SizedBox.shrink();
                                  return Positioned(
                                    right: -9,
                                    top: -6,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 5, vertical: 1),
                                      decoration: BoxDecoration(
                                        gradient: _heroGradient,
                                        borderRadius: BorderRadius.circular(9),
                                        border:
                                            Border.all(color: _onLime, width: 2),
                                      ),
                                      constraints:
                                          const BoxConstraints(minWidth: 19),
                                      child: Text('$n',
                                          textAlign: TextAlign.center,
                                          style: _txt(10,
                                              weight: FontWeight.w800,
                                              color: _onLime)),
                                    ),
                                  );
                                },
                              ),
                          ],
                        ),
                        const SizedBox(height: 3),
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
              ),
          ],
        ),
      ),
    );
  }
}

/// The header every screen wears: the brand's blue, rounded at its foot.
class _Header extends StatelessWidget {
  const _Header({required this.subtitle, this.trailing});

  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_lime, _lime],
          ),
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(26)),
        ),
        child: Stack(
          children: [
            // A soft light in the corner, so the blue has depth rather
            // than being a flat slab.
            Positioned(
              right: -60,
              top: -90,
              child: Container(
                width: 230,
                height: 230,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    _white.withOpacity(0),
                    _white.withOpacity(0),
                  ]),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                  16, MediaQuery.paddingOf(context).top + 10, 14, 14),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _onLime.withOpacity(0.10),
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(color: _onLime.withOpacity(0.18)),
                    ),
                    child: Text('AH',
                        style: _title(14,
                            weight: FontWeight.w800, color: _onLime)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Al Hadeed Hardware',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: _title(17,
                                weight: FontWeight.w800, color: _onLime)),
                        const SizedBox(height: 2),
                        Text(subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                _txt(12.5, color: _onLime.withOpacity(0.92))),
                      ],
                    ),
                  ),
                  if (trailing != null) trailing!,
                ],
              ),
            ),
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
              // A soft rounded tile with a ring, not a flat grey disc.
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: tone == _ember
                        ? [_emberPale, _emberPale]
                        : [_brandPale, _brandPale],
                  ),
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(
                      color: tone == _ember
                          ? _ember.withOpacity(0.18)
                          : _brand.withOpacity(0.14)),
                ),
                child: Icon(icon,
                    size: 32, color: tone == _ember ? _ember : _brand),
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
                    decoration: _liquid(tint: _lime, radius: 23),
                    child: Text(action!,
                        style:
                            _txt(15, weight: FontWeight.w600, color: _onLime)),
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
      } else {
        // An account deleted on this phone took these with it.
        phone = fullName = location = '';
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
//  THE CUSTOMER'S OWN DELIVERY MEN
//
//  Kept on the phone, newest first, so the next order is one tap.
// ═══════════════════════════════════════════════════════════════

class _Drivers {
  static const _key = 'alhadeed.drivers';

  static Future<List<Map<String, dynamic>>> load() async {
    final p = await SharedPreferences.getInstance();
    try {
      return ((jsonDecode(p.getString(_key) ?? '[]') as List))
          .map((x) => (x as Map).cast<String, dynamic>())
          .toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> remember(Map<String, dynamic> d) async {
    final p = await SharedPreferences.getInstance();
    final all = await load();
    String key(Map m) => '${m['plate']}'.toUpperCase().replaceAll(' ', '');
    all.removeWhere((x) => key(x) == key(d) && key(d).isNotEmpty);
    all.insert(0, d);
    await p.setString(_key, jsonEncode(all.take(6).toList()));
  }

  static Future<void> forget(Map<String, dynamic> d) async {
    final p = await SharedPreferences.getInstance();
    final all = await load();
    all.removeWhere((x) => '${x['plate']}' == '${d['plate']}' && '${x['name']}' == '${d['name']}');
    await p.setString(_key, jsonEncode(all));
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
  bool _sessionRead = false;
  final _name = TextEditingController();
  final _location = TextEditingController();

  /// 'shop_delivery' | 'own_transport' | 'pickup'
  String _delivery = 'shop_delivery';

  /// Their own delivery man: saved ones, the one chosen, or a new one.
  List<Map<String, dynamic>> _drivers = [];
  int _driver = -1; // index in _drivers, or -1 for a new one
  final _dName = TextEditingController();
  final _dPhone = TextEditingController();
  final _dPlate = TextEditingController();
  String _dVehicle = 'Boda boda';

  Map<String, dynamic> get _collector => _driver >= 0 && _driver < _drivers.length
      ? _drivers[_driver]
      : {
          'name': _dName.text.trim(),
          'phone': _dPhone.text.trim(),
          'vehicle': _dVehicle,
          'plate': _dPlate.text.trim().toUpperCase(),
        };

  bool get _collectorOk {
    if (_delivery != 'own_transport') return true;
    final c = _collector;
    return '${c['name']}'.trim().length >= 2 &&
        '${c['phone']}'.replaceAll(RegExp(r'[^0-9]'), '').length >= 9 &&
        '${c['plate']}'.trim().length >= 3;
  }

  /// The customer's credit account, when the shop gives them one.
  Map<String, dynamic>? _credit;
  bool _onCredit = false;

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
    _dName.dispose();
    _dPhone.dispose();
    _dPlate.dispose();
    super.dispose();
  }

  Future<void> _boot() async {
    await _Session().load();
    if (!mounted) return;
    setState(() => _sessionRead = true);
    if (_Session().isStaff) return;
    await _CartStore().load();
    await _Details().load();
    if (!mounted) return;

    _name.text = _Details().fullName;
    _location.text = _Details().location;
    _drivers = await _Drivers.load();
    _driver = _drivers.isEmpty ? -1 : 0;
    if (_Session().signedIn) {
      try {
        final r = await _apiGet('/api/me/credit');
        _credit = (r['account'] as Map?)?.cast<String, dynamic>();
      } on _ApiError {
        _credit = null;
      }
    }
    setState(() => _ready = true);

    // The number is the first thing asked for, and only once there is
    // something to order. After the frame, or there is no Navigator yet.
    if (_Session().signedIn &&
        _Details().phone.isEmpty &&
        _CartStore().lines.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _askPhone());
    }
  }

  Future<void> _signIn() async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _SignInSheet(),
    );
    if (ok == true && mounted) {
      setState(() => _error = null);
      await _boot();
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
      !_overLimit &&
      _collectorOk &&
      (!_onCredit || _creditProblem == null);

  int _n(Object? v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;

  /// Why credit cannot be used at all (paying would not help), or null.
  String? get _creditProblem {
    final c = _credit;
    if (c == null) return 'You have no credit with the shop.';
    if (c['status'] == 'hold') return 'Your credit is stopped. Please see the shop.';
    if (c['status'] == 'closed') return 'Your credit account is closed.';
    return null;
  }

  /// How much to pay off first so this order fits: what is late, and
  /// enough to bring the total under the limit. 0 when it fits now.
  int get _payFirst {
    final c = _credit;
    if (c == null || _creditProblem != null) return 0;
    final over = _n(c['owed']) + _CartStore().subtotal - _n(c['limit']);
    return [0, _n(c['overdue']), over].reduce((a, b) => a > b ? a : b);
  }

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
      final r = await _apiPost('/api/orders', {
        'items': items,
        'fulfilment':
            _delivery == 'shop_delivery' ? 'delivery' : _delivery,
        if (_delivery == 'shop_delivery')
          'deliveryAddress': _location.text.trim()
        else if (_location.text.trim().isNotEmpty)
          'location': _location.text.trim(),
        'phone': _Details().phone.trim(),
        'fullName': _name.text.trim(),
        if (_onCredit) 'onCredit': true,
        if (_delivery == 'own_transport') 'collector': _collector,
      });
      if (_delivery == 'own_transport') await _Drivers.remember(_collector);
      final order = (r['order'] as Map).cast<String, dynamic>();
      final smsSent = r['smsSent'] != false;

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
            _OrderPlacedSheet(
                order: order, smsSent: smsSent, phone: _Details().phone),
      );
    } on _ApiError catch (e) {
      if (!mounted) return;
      if (e.unauthorised) {
        // The session ran out. Keep the cart, ask them back in.
        await _Session().signOut();
        if (!mounted) return;
        setState(() {
          _placing = false;
          _error = 'Please sign in again to place this order.';
        });
        return;
      }
      // The server's wording is better than anything invented here:
      // "Only 8 length of Iron Bar Y12 left in stock" says exactly what
      // to do next.
      setState(() {
        _error = e.message;
        _placing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    _ui = (mq.size.width / 390).clamp(0.86, 1.08);
    if (!_sessionRead) return Container(color: _bg);
    // Staff have their own side of the app. It replaces this screen, so
    // there is no shop underneath to go back to.
    if (_Session().isStaff) {
      return AlHadeedStaff(width: widget.width, height: widget.height);
    }

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
                                  size: 19, color: _onLime),
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

  /// One numbered step of the page, in its own card.
  Widget _section(int n, String title, List<Widget> children, {Widget? trailing}) =>
      Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: _hairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: _lime, shape: BoxShape.circle),
                child: Text('$n', style: _txt(11.5, weight: FontWeight.w800, color: _onLime)),
              ),
              const SizedBox(width: 8),
              Expanded(child: Text(title, style: _title(14.5, weight: FontWeight.w800))),
              if (trailing != null) trailing,
            ]),
            const SizedBox(height: 10),
            ...children,
          ],
        ),
      );

  /// The loan, at the top of the page, for anyone who owes the shop.
  Widget _loanStrip() {
    final c = _credit!;
    final owed = _n(c['owed']);
    final limit = _n(c['limit']);
    final late = _n(c['overdue']);
    final over = owed > limit;
    final bad = over || late > 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: bad ? _emberPale : _brandPale,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: (bad ? _ember : _brand).withOpacity(0.25)),
      ),
      child: Row(children: [
        Icon(Icons.account_balance_wallet_rounded, size: 18, color: bad ? _ember : _brand),
        const SizedBox(width: 9),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Your loan: ${_ugx(owed)} of ${_ugx(limit)}',
                  style: _txt(12.5, weight: FontWeight.w800, color: bad ? _ember : _brandDark)),
              Text(
                  over
                      ? 'Over your limit by ${_ugx(owed - limit)}${late > 0 ? ' · ${_shortUgx(late)} late' : ''}'
                      : late > 0
                          ? '${_ugx(late)} is late'
                          : '${_ugx(_n(c['available']))} left to use',
                  style: _txt(11.5, color: _inkSoft)),
            ],
          ),
        ),
      ]),
    );
  }

  Widget _vehicleChip(String v, IconData icon) {
    final on = _dVehicle == v;
    return Padding(
      padding: const EdgeInsets.only(right: 6, bottom: 6),
      child: _Pressable(
        scale: 0.95,
        onTap: () => setState(() => _dVehicle = v),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
          decoration: BoxDecoration(
            color: on ? _lime : _tile,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: on ? _lime : _hairline),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 16, color: on ? _onLime : _mid),
            const SizedBox(width: 5),
            Text(v, style: _txt(12.5, weight: FontWeight.w700, color: on ? _onLime : _inkSoft)),
          ]),
        ),
      ),
    );
  }

  IconData _vehicleIcon(String v) => switch (v) {
        'Boda boda' => Icons.two_wheeler_rounded,
        'Car' => Icons.directions_car_rounded,
        'Truck' => Icons.local_shipping_rounded,
        _ => Icons.commute_rounded,
      };

  /// Who comes for the goods: a saved delivery man, or a new one.
  Widget _driverBox() => Container(
        margin: const EdgeInsets.only(top: 2, bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: _tile,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _hairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Your delivery man', style: _txt(13, weight: FontWeight.w800, color: _ink)),
            const SizedBox(height: 2),
            Text('The store checks his name and plate before giving him the goods.',
                style: _txt(11.5, color: _mid)),
            const SizedBox(height: 10),
            for (var i = 0; i < _drivers.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: _Pressable(
                  scale: 0.99,
                  onTap: () => setState(() => _driver = i),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _driver == i ? _brandPale : _white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: _driver == i ? _brand : _hairline),
                    ),
                    child: Row(children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: _driver == i ? _lime : _tile,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(_vehicleIcon('${_drivers[i]['vehicle']}'),
                            size: 17, color: _driver == i ? _onLime : _mid),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${_drivers[i]['name']}',
                                style: _txt(13, weight: FontWeight.w700, color: _ink)),
                            Text(
                                '${_drivers[i]['vehicle']} · ${_drivers[i]['plate']} · ${_drivers[i]['phone']}',
                                style: _txt(11.5, color: _mid)),
                          ],
                        ),
                      ),
                      if (_driver == i)
                        const Icon(Icons.check_circle_rounded, size: 20, color: _brand)
                      else
                        GestureDetector(
                          onTap: () async {
                            await _Drivers.forget(_drivers[i]);
                            final all = await _Drivers.load();
                            setState(() {
                              _drivers = all;
                              _driver = all.isEmpty ? -1 : 0;
                            });
                          },
                          child: const Icon(Icons.close_rounded, size: 18, color: _light),
                        ),
                    ]),
                  ),
                ),
              ),
            if (_drivers.isNotEmpty)
              _Pressable(
                scale: 0.99,
                onTap: () => setState(() => _driver = -1),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
                  decoration: BoxDecoration(
                    color: _driver == -1 ? _brandPale : _white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _driver == -1 ? _brand : _hairline),
                  ),
                  child: Row(children: [
                    const Icon(Icons.person_add_alt_rounded, size: 18, color: _brand),
                    const SizedBox(width: 8),
                    Text('A different delivery man',
                        style: _txt(13, weight: FontWeight.w700, color: _brandDark)),
                  ]),
                ),
              ),
            if (_driver == -1) ...[
              const SizedBox(height: 10),
              _Field(
                controller: _dName,
                hint: 'His name',
                capitalisation: TextCapitalization.words,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 8),
              _Field(
                controller: _dPhone,
                hint: 'His phone number',
                keyboardType: TextInputType.phone,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 10),
              Text('What is he coming with?', style: _txt(12, weight: FontWeight.w700, color: _inkSoft)),
              const SizedBox(height: 6),
              Wrap(children: [
                _vehicleChip('Boda boda', Icons.two_wheeler_rounded),
                _vehicleChip('Car', Icons.directions_car_rounded),
                _vehicleChip('Truck', Icons.local_shipping_rounded),
                _vehicleChip('Other', Icons.commute_rounded),
              ]),
              const SizedBox(height: 4),
              _Field(
                controller: _dPlate,
                hint: 'Plate number, e.g. UFA 123B',
                capitalisation: TextCapitalization.characters,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 6),
              Text('Saved on this phone for your next order.', style: _txt(11, color: _light)),
            ],
          ],
        ),
      );

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

    final hasCredit = _credit != null && _credit!['status'] != 'none';
    final owes = hasCredit && _n(_credit!['owed']) > 0;

    return Column(
      children: [
        Expanded(
          child: ListView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
            children: [
              if (_Session().signedIn && owes) _loanStrip(),

              _section(1, 'Your items', [
                for (final line in _CartStore().lines) _cartLine(line),
              ],
                  trailing: Text('${_CartStore().count} items',
                      style: _txt(12, weight: FontWeight.w700, color: _mid))),

              // Signed out: the total, and the way in.
              if (!_Session().signedIn) ...[
                _totals(),
                const SizedBox(height: 10),
                _signInCard(),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  _notice(icon: Icons.error_outline_rounded, tone: _ember, bg: _emberPale, text: _error!),
                ],
              ] else ...[
                _section(2, 'Who is ordering', [
                  _phoneRow(),
                  const SizedBox(height: 8),
                  _Field(
                    controller: _name,
                    hint: 'Your name',
                    capitalisation: TextCapitalization.words,
                    onChanged: (_) => setState(() {}),
                  ),
                ]),

                _section(3, 'How it gets to you', [
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
                    line: 'Your boda, car or truck picks it up at the shop.',
                  ),
                  if (_delivery == 'own_transport') _driverBox(),
                  _deliveryOption(
                    value: 'pickup',
                    icon: Icons.storefront_outlined,
                    title: 'I will collect it myself',
                    line: 'Come to the counter with your order number.',
                  ),
                  const SizedBox(height: 4),
                  Text(_needsLocation ? 'Where to deliver' : 'Where it is going (optional)',
                      style: _txt(12, weight: FontWeight.w700, color: _inkSoft)),
                  const SizedBox(height: 6),
                  _Field(
                    controller: _location,
                    hint: 'Plot 24, Bukoto · behind the fuel station',
                    maxLines: 2,
                    capitalisation: TextCapitalization.sentences,
                    onChanged: (_) => setState(() {}),
                  ),
                  if (_needsLocation) ...[
                    const SizedBox(height: 5),
                    Text('A plot number and a landmark help: the driver calls you on arrival.',
                        style: _txt(11, color: _light, height: 1.4)),
                  ],
                ]),

                if (hasCredit)
                  _section(4, 'How you pay', [
                    _creditMini(),
                    const SizedBox(height: 10),
                    _payOption(
                      credit: false,
                      icon: Icons.payments_outlined,
                      title: 'Pay at the cashier',
                      line: 'Cash, Mobile Money or card at the counter.',
                    ),
                    _payOption(
                      credit: true,
                      icon: Icons.account_balance_wallet_outlined,
                      title: 'Buy on credit',
                      line: _creditProblem ??
                          (_payFirst > 0
                              ? 'Pay ${_ugx(_payFirst)} off your credit at the shop first, then take the goods. You can order now.'
                              : '${_ugx(_n(_credit!['available']))} left. Pay within ${_n(_credit!['termsDays'])} days.'),
                      bad: _creditProblem != null,
                    ),
                    if (_onCredit && _payFirst > 0 && _creditProblem == null)
                      _notice(
                        icon: Icons.info_outline_rounded,
                        tone: _amber,
                        bg: _amberPale,
                        text: 'You owe ${_ugx(_n(_credit!['owed']))} of your ${_ugx(_n(_credit!['limit']))} limit'
                            '${_n(_credit!['overdue']) > 0 ? ', and ${_ugx(_n(_credit!['overdue']))} is late' : ''}. '
                            'To collect or have this delivered, first pay ${_ugx(_payFirst)} at the shop. '
                            'The cashier then puts the order on your credit.',
                      ),
                  ]),

                _totals(),

                if (_overLimit) ...[
                  const SizedBox(height: 10),
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
                  const SizedBox(height: 10),
                  _notice(icon: Icons.error_outline_rounded, tone: _ember, bg: _emberPale, text: _error!),
                ],
              ],
              const SizedBox(height: 10),
            ],
          ),
        ),
        if (_Session().signedIn) _placeBar(),
      ],
    );
  }

  Widget _signInCard() => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _brand.withOpacity(0.18)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Sign in to order', style: _title(18)),
            const SizedBox(height: 6),
            Text(
                'With an SMS code, or your email and password. New here? An '
                'SMS code creates your account. Your cart stays as it is.',
                style: _txt(13, color: _mid, height: 1.45)),
            const SizedBox(height: 14),
            _Pressable(
              scale: 0.98,
              onTap: _signIn,
              child: Container(
                height: 46,
                alignment: Alignment.center,
                decoration: _liquid(tint: _lime, radius: 25),
                child: Text('Sign in',
                    style: _txt(15, weight: FontWeight.w600, color: _onLime)),
              ),
            ),
          ],
        ),
      );

  Widget _label(String text) =>
      Text(text, style: _txt(11.5, weight: FontWeight.w700, color: _light));

  /// The number is tapped to change, not typed over: it is the one field
  /// that decides whose order this is, and the SMS goes to it.
  Widget _phoneRow() => _Pressable(
        scale: 0.99,
        onTap: _askPhone,
        child: Container(
          padding: const EdgeInsets.all(16),
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
          padding: const EdgeInsets.all(16),
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

  /// What the customer owes against the limit, at a glance.
  Widget _creditMini() {
    final c = _credit!;
    final owed = _n(c['owed']);
    final limit = _n(c['limit']);
    final late = _n(c['overdue']);
    final used = limit > 0 ? (owed / limit).clamp(0.0, 1.0) : 1.0;
    final over = owed > limit;
    Widget fig(String k, String v, Color col) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(k, style: _txt(10.5, color: _white.withOpacity(0.6))),
              const SizedBox(height: 1),
              Text(v, style: _txt(13, weight: FontWeight.w800, color: col)),
            ],
          ),
        );
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(color: _navy, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.account_balance_wallet_rounded, size: 16, color: _lime),
            const SizedBox(width: 7),
            Text('My credit', style: _txt(12.5, weight: FontWeight.w700, color: _white)),
            const Spacer(),
            Text(owed < 0 ? 'In advance ${_ugx(-owed)}' : 'Owe ${_ugx(owed)}',
                style: _txt(13, weight: FontWeight.w800, color: _white)),
          ]),
          const SizedBox(height: 9),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: used,
              minHeight: 7,
              backgroundColor: _white.withOpacity(0.14),
              color: over ? _ember : (used >= 0.8 ? const Color(0xFFE0A030) : _lime),
            ),
          ),
          const SizedBox(height: 9),
          Row(children: [
            fig('Limit', _shortUgx(limit), _white),
            fig('Left', _shortUgx(_n(c['available'])), _n(c['available']) > 0 ? _lime : _white.withOpacity(0.5)),
            fig('Late', late > 0 ? _shortUgx(late) : 'Nothing', late > 0 ? const Color(0xFFFF8A80) : _lime),
          ]),
        ],
      ),
    );
  }

  Widget _payOption({
    required bool credit,
    required IconData icon,
    required String title,
    required String line,
    bool bad = false,
  }) {
    final on = _onCredit == credit;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: _Pressable(
        scale: 0.99,
        onTap: () => setState(() => _onCredit = credit),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: on ? _brandPale : _white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: on ? _brand : _hairline),
          ),
          child: Row(children: [
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
                  Text(line,
                      style: _txt(12,
                          color: bad ? _ember : _mid,
                          weight: bad ? FontWeight.w600 : FontWeight.w400,
                          height: 1.35)),
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
          ]),
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
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: _tile,
        borderRadius: BorderRadius.circular(14),
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
              Text(_onCredit ? 'On your credit' : 'To pay at the cashier',
                  style: _title(15)),
              const Spacer(),
              Text(_ugx(subtotal), style: _title(20, weight: FontWeight.w800)),
            ],
          ),
          if (_onCredit && _credit != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _tile,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _hairline),
              ),
              child: Column(children: [
                _totalRow('You owe now', _ugx(_n(_credit!['owed']))),
                const SizedBox(height: 7),
                _totalRow('This order', '+${_ugx(subtotal)}'),
                if (_payFirst > 0) ...[
                  const SizedBox(height: 7),
                  _totalRow('Pay first at the shop', '-${_ugx(_payFirst)}', good: true),
                ],
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 9),
                  child: Divider(height: 1, thickness: 1, color: _hairline),
                ),
                Row(children: [
                  Text('You will owe', style: _txt(13.5, weight: FontWeight.w700, color: _ink)),
                  const Spacer(),
                  Text(_ugx(_n(_credit!['owed']) + subtotal - _payFirst),
                      style: _txt(14.5, weight: FontWeight.w800, color: _ink)),
                ]),
                const SizedBox(height: 3),
                Row(children: [
                  Text('Your limit', style: _txt(12, color: _mid)),
                  const Spacer(),
                  Text(_ugx(_n(_credit!['limit'])), style: _txt(12, color: _mid)),
                ]),
              ]),
            ),
          ],
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
        padding: const EdgeInsets.all(16),
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
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
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
                          ? '${_CartStore().count} items · ${_onCredit ? 'on credit' : 'pay at the cashier'}'
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
                      ? _liquid(tint: _lime, radius: 26)
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
                              strokeWidth: 2, color: _onLime),
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
    if (_onCredit && _creditProblem != null) return 'Credit cannot be used';
    if (_Details().phone.trim().length < 9) return 'Add your phone number';
    if (_name.text.trim().length < 2) return 'Add your name';
    if (_needsLocation && _location.text.trim().isEmpty) {
      return 'Say where to deliver';
    }
    if (!_collectorOk) return 'Add your delivery man';
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
                  decoration: _liquid(tint: _lime, radius: 26),
                  child: Text('Continue',
                      style:
                          _txt(15, weight: FontWeight.w600, color: _onLime)),
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
              padding: const EdgeInsets.all(16),
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
                          : 'The text could not be sent just now, but your '
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
                      Text(
                          order['wants_credit'] == true
                              ? 'On your credit'
                              : 'To pay at the cashier',
                          style: _txt(13.5, color: _inkSoft)),
                      const Spacer(),
                      Text(_ugx((order['total'] as num?)?.toInt() ?? 0),
                          style: _title(17, weight: FontWeight.w800)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Divider(height: 1, thickness: 1, color: _hairline),
                  const SizedBox(height: 12),
                  order['wants_credit'] == true
                      ? ((order['credit_pay_first'] as num? ?? 0) > 0
                          ? _step(1, 'Pay ${_ugx((order['credit_pay_first'] as num).toInt())} at the cashier first',
                              'That brings you under your credit limit. Then the order goes on your credit.')
                          : _step(1, 'Show your order number at the cashier',
                              'It goes on your credit. Nothing to pay now.'))
                      : _step(1, 'Pay at the cashier',
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
                decoration: _liquid(tint: _lime, radius: 26),
                child: Text('See it in my orders',
                    style: _txt(15, weight: FontWeight.w600, color: _onLime)),
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
                      height: 46,
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
                      height: 46,
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

// ═══════════════════════════════════════════════════════════════
//  SHEET — SIGN IN
//
//  Identical in al_hadeed_shop.dart, al_hadeed_cart.dart and
//  al_hadeed_company.dart.
// ═══════════════════════════════════════════════════════════════

/// One sign-in for everybody: a customer with an SMS code, or anybody
/// with a password. Whose account it turns out to be decides which side
/// of the app opens. Pops `true` once signed in.
class _SignInSheet extends StatefulWidget {
  const _SignInSheet();

  @override
  State<_SignInSheet> createState() => _SignInSheetState();
}

class _SignInSheetState extends State<_SignInSheet> {
  final _phone = TextEditingController();
  final _name = TextEditingController();
  final _code = TextEditingController();
  final _who = TextEditingController();
  final _password = TextEditingController();

  bool _usePassword = false;
  bool _askName = false;
  bool _sent = false;
  bool _busy = false;
  bool _hidden = true;
  String? _error;
  String? _devCode;

  @override
  void dispose() {
    for (final c in [_phone, _name, _code, _who, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _ready {
    if (_busy) return false;
    if (_usePassword) {
      return _who.text.trim().length >= 3 && _password.text.isNotEmpty;
    }
    if (_sent) return _code.text.trim().length == 6;
    return _phone.text.replaceAll(RegExp(r'[^0-9]'), '').length >= 9 &&
        (!_askName || _name.text.trim().length >= 2);
  }

  /// A shop whose plugin is older than this app has only the staff door.
  Future<Map<String, dynamic>> _passwordSignIn() async {
    final body = {
      'identifier': _who.text.trim(),
      'password': _password.text,
    };
    try {
      return await _apiPost('/api/auth/login', body);
    } on _ApiError catch (e) {
      if (e.code != 'rest_no_route') rethrow;
      return _apiPost('/api/auth/staff/login', body);
    }
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      if (!_usePassword && !_sent) {
        final r = await _apiPost('/api/auth/otp/request', {
          'phone': _phone.text.trim(),
          if (_askName) 'fullName': _name.text.trim(),
        });
        if (!mounted) return;
        setState(() {
          _sent = true;
          _busy = false;
          // Only ever sent back by a shop still in test mode.
          _devCode = r['devCode']?.toString();
        });
        return;
      }

      final r = _usePassword
          ? await _passwordSignIn()
          : await _apiPost('/api/auth/otp/verify', {
              'phone': _phone.text.trim(),
              'code': _code.text.trim(),
              if (_askName) 'fullName': _name.text.trim(),
            });
      final token = r['token'] as String;
      final user = (r['user'] as Map).cast<String, dynamic>();
      await _Session().save(token, user);

      // The sign-in gives a company's id but not its name, which the
      // header shows. Cosmetic: a failure here leaves the sign-in alone.
      if (user['companyId'] != null) {
        try {
          final me = await _apiGet('/api/auth/me');
          final full = (me['user'] as Map).cast<String, dynamic>();
          final company = full['company'] as Map<String, dynamic>?;
          if (company != null) full['companyName'] = company['company_name'];
          await _Session().save(token, full);
        } on _ApiError {
          // Keep the session we already have.
        }
      }
      HapticFeedback.mediumImpact();
      navigator.pop(true);
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        // A number the shop has not met: ask for a name, then carry on.
        if (e.code == 'ah_unknown_phone' && !_askName) {
          _askName = true;
        } else {
          _error = e.message;
        }
      });
    }
  }

  Widget _tab(String label, IconData icon, bool password) {
    final on = _usePassword == password;
    return Expanded(
      child: _Pressable(
        scale: 0.97,
        onTap: _busy
            ? null
            : () => setState(() {
                  _usePassword = password;
                  _error = null;
                }),
        child: Container(
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: on ? _white : _white.withOpacity(0),
            borderRadius: BorderRadius.circular(12),
            boxShadow: on ? _cardShadow : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 17, color: on ? _brand : _mid),
              const SizedBox(width: 7),
              Text(label,
                  style: _txt(13.5,
                      weight: on ? FontWeight.w700 : FontWeight.w500,
                      color: on ? _ink : _mid)),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final again = (_) => setState(() {});
    final help = _usePassword
        ? 'Use your email or phone number and your password. Staff sign in '
            'here too.'
        : _sent
            ? 'We sent a 6-digit code to ${_phone.text.trim()}. It expires in '
                '5 minutes.'
            : _askName
                ? 'That number is new here. Add your name and we will text a '
                    'code to create your account.'
                : 'Enter your phone number and we will text you a code.';

    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Sign in', style: _title(22, weight: FontWeight.w800)),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: _bg,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(children: [
                _tab('SMS code', Icons.sms_outlined, false),
                _tab('Password', Icons.lock_outline_rounded, true),
              ]),
            ),
            const SizedBox(height: 14),
            Text(help, style: _txt(13, color: _mid, height: 1.45)),
            const SizedBox(height: 14),
            if (_usePassword) ...[
              _Field(
                key: const ValueKey('who'),
                controller: _who,
                hint: 'Email or phone number',
                keyboardType: TextInputType.emailAddress,
                onChanged: again,
              ),
              const SizedBox(height: 10),
              _Field(
                key: const ValueKey('password'),
                controller: _password,
                hint: 'Password',
                obscure: _hidden,
                onChanged: again,
              ),
              TextButton(
                onPressed: () => setState(() => _hidden = !_hidden),
                child: Text(_hidden ? 'Show password' : 'Hide password',
                    style: _txt(12.5,
                        weight: FontWeight.w600, color: _brandDark)),
              ),
            ] else if (_sent) ...[
              _Field(
                key: const ValueKey('code'),
                controller: _code,
                hint: '6-digit code',
                keyboardType: TextInputType.number,
                maxLength: 6,
                autofocus: true,
                onChanged: again,
              ),
              if (_devCode != null) ...[
                const SizedBox(height: 8),
                Text('Test mode: your code is $_devCode',
                    style: _txt(12.5, color: _brandDark)),
              ],
            ] else ...[
              _Field(
                key: const ValueKey('phone'),
                controller: _phone,
                hint: '0772 123 456',
                keyboardType: TextInputType.phone,
                onChanged: (_) => setState(() => _askName = false),
              ),
              if (_askName) ...[
                const SizedBox(height: 10),
                _Field(
                  key: const ValueKey('name'),
                  controller: _name,
                  hint: 'Your name',
                  capitalisation: TextCapitalization.words,
                  autofocus: true,
                  onChanged: again,
                ),
              ],
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: _txt(12.5, color: _ember, height: 1.4)),
            ],
            const SizedBox(height: 18),
            _Pressable(
              scale: 0.98,
              onTap: _ready ? _submit : null,
              child: Opacity(
                opacity: _ready || _busy ? 1 : 0.45,
                child: Container(
                  height: 52,
                  width: double.infinity,
                  alignment: Alignment.center,
                  decoration: _liquid(tint: _lime, radius: 26),
                  child: _busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: _onLime),
                        )
                      : Text(
                          _usePassword
                              ? 'Sign in'
                              : _sent
                                  ? 'Verify & sign in'
                                  : 'Text me a code',
                          style: _txt(15,
                              weight: FontWeight.w600, color: _onLime)),
                ),
              ),
            ),
            if (_sent && !_usePassword)
              Center(
                child: TextButton(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                            _sent = false;
                            _askName = false;
                            _code.clear();
                            _devCode = null;
                            _error = null;
                          }),
                  child: Text('Use a different number',
                      style: _txt(13.5,
                          weight: FontWeight.w600, color: _brandDark)),
                ),
              ),
            SizedBox(height: mq.padding.bottom + 4),
          ],
        ),
      ),
    );
  }
}
